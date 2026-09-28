const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reportes/mayor - Consolidación del Libro Mayor en Tiempo Real (Solo Cuentas Principales de 4 dígitos)
router.get('/mayor', async (req, res) => {
  try {
    // 1. Obtener únicamente las cuentas principales de 4 dígitos de código
    const [cuentas] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
       FROM catalogo_cuentas c
       WHERE LENGTH(c.codigo) = 4
       ORDER BY c.codigo ASC`
    );

    const libroMayor = [];

    for (let c of cuentas) {
      // Consolidar débitos y créditos acumulando la cuenta principal y sus subcuentas
      const [sumRow] = await db.query(
        `SELECT 
          COALESCE(SUM(d.debe), 0) AS total_debe,
          COALESCE(SUM(d.haber), 0) AS total_haber
         FROM detalle_asiento d
         INNER JOIN catalogo_cuentas sub ON d.cuenta_id = sub.id
         WHERE sub.codigo = ? OR sub.codigo LIKE (? || '%')`,
        [c.codigo, c.codigo]
      );

      const debe = parseFloat(sumRow[0].total_debe || 0);
      const haber = parseFloat(sumRow[0].total_haber || 0);
      let saldo = 0;

      if (c.naturaleza === 'DEUDORA') {
        saldo = debe - haber;
      } else {
        saldo = haber - debe;
      }

      // Obtener movimientos individuales pertenecientes a la cuenta principal o sus subcuentas
      const [movimientos] = await db.query(
        `SELECT p.numero_partida, p.fecha, p.concepto, d.debe, d.haber
         FROM detalle_asiento d
         INNER JOIN partidas p ON d.partida_id = p.id
         INNER JOIN catalogo_cuentas sub ON d.cuenta_id = sub.id
         WHERE sub.codigo = ? OR sub.codigo LIKE (? || '%')
         ORDER BY p.fecha ASC, p.numero_partida ASC`,
        [c.codigo, c.codigo]
      );

      libroMayor.push({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        total_debe: debe,
        total_haber: haber,
        saldo: Math.round(saldo * 100) / 100,
        movimientos
      });
    }

    res.json({ success: true, libroMayor });
  } catch (error) {
    console.error('Error al generar Libro Mayor:', error);
    res.status(500).json({ success: false, message: 'Error al generar Libro Mayor.', error: error.message });
  }
});

// GET /api/reportes/dashboard - Resumen y estadísticas para el Panel Principal
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ totalPartidas }]] = await db.query(
      `SELECT COUNT(*) AS totalPartidas FROM partidas`
    );

    const [[{ cuentasMayorizadas }]] = await db.query(
      `SELECT COUNT(DISTINCT cuenta_id) AS cuentasMayorizadas FROM detalle_asiento`
    );

    const [mesesRows] = await db.query(
      `SELECT 
        CAST(SUBSTR(p.fecha, 6, 2) AS INTEGER) AS mes_num,
        SUM(d.debe) AS total_debe,
        SUM(d.haber) AS total_haber
       FROM detalle_asiento d
       INNER JOIN partidas p ON d.partida_id = p.id
       WHERE p.fecha IS NOT NULL AND LENGTH(p.fecha) >= 7
       GROUP BY mes_num
       ORDER BY mes_num ASC`
    );

    const debePorMes = Array(12).fill(0);
    const haberPorMes = Array(12).fill(0);
    const partidasPorMes = Array(12).fill(0);

    mesesRows.forEach(r => {
      const idx = parseInt(r.mes_num, 10) - 1;
      if (idx >= 0 && idx < 12) {
        debePorMes[idx] = Math.round(parseFloat(r.total_debe || 0) * 100) / 100;
        haberPorMes[idx] = Math.round(parseFloat(r.total_haber || 0) * 100) / 100;
      }
    });

    const [partidasMesRows] = await db.query(
      `SELECT CAST(SUBSTR(fecha, 6, 2) AS INTEGER) AS mes_num, COUNT(*) AS total
       FROM partidas
       WHERE fecha IS NOT NULL AND LENGTH(fecha) >= 7
       GROUP BY mes_num`
    );
    partidasMesRows.forEach(r => {
      const idx = parseInt(r.mes_num, 10) - 1;
      if (idx >= 0 && idx < 12) {
        partidasPorMes[idx] = parseInt(r.total || 0, 10);
      }
    });

    const [[{ deudoras }]] = await db.query(
      `SELECT COUNT(DISTINCT c.id) AS deudoras
       FROM catalogo_cuentas c
       INNER JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.naturaleza = 'DEUDORA'`
    );
    const [[{ acreedoras }]] = await db.query(
      `SELECT COUNT(DISTINCT c.id) AS acreedoras
       FROM catalogo_cuentas c
       INNER JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.naturaleza = 'ACREEDORA'`
    );

    res.json({
      success: true,
      data: {
        totalPartidas: parseInt(totalPartidas || 0, 10),
        cuentasMayorizadas: parseInt(cuentasMayorizadas || 0, 10),
        debePorMes,
        haberPorMes,
        partidasPorMes,
        naturaleza: {
          deudoras: parseInt(deudoras || 0, 10),
          acreedoras: parseInt(acreedoras || 0, 10)
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos del dashboard.', error: error.message });
  }
});

// Funciones auxiliares para clasificación estricta y flexible de cuentas contables y subcuentas
function esCuentaVentas(codigo, nombre) {
  const n = (nombre || '').toLowerCase();
  if (codigo === '5101' || codigo === '5104' || codigo === '510101') return true;
  if (codigo.startsWith('51') && !codigo.startsWith('5102') && !codigo.startsWith('5103') && codigo !== '510102') {
    if (!n.includes('devoluc') && !n.includes('rebaja') && !n.includes('descuento')) return true;
  }
  return false;
}

function esCuentaDevVentas(codigo, nombre) {
  const n = (nombre || '').toLowerCase();
  if (codigo === '5103' || codigo === '510102') return true;
  if (n.includes('devoluc') || n.includes('rebaja') || n.includes('descuento')) {
    if (n.includes('venta')) return true;
  }
  return false;
}

function esCuentaCompras(codigo, nombre) {
  const n = (nombre || '').toLowerCase();
  if (codigo === '4102' || codigo === '410101') return true;
  if (codigo.startsWith('41') && !codigo.startsWith('4103') && !codigo.startsWith('4104') && codigo !== '410102' && codigo !== '410103') {
    if (n === 'compras' || n.includes('compra de mercad') || n.includes('compras de mercad')) return true;
  }
  return false;
}

function esCuentaGastosCompras(codigo, nombre) {
  const n = (nombre || '').toLowerCase();
  if (codigo === '4103' || codigo === '410103') return true;
  if (n.includes('gastos sobre compra') || n.includes('flete') || n.includes('acarreos sobre compra')) return true;
  return false;
}

function esCuentaDevCompras(codigo, nombre) {
  const n = (nombre || '').toLowerCase();
  if (codigo === '4104' || codigo === '410102') return true;
  if (n.includes('devoluc') || n.includes('rebaja') || n.includes('descuento')) {
    if (n.includes('compra')) return true;
  }
  return false;
}

// GET /api/reportes/estado-resultados - Estado de Resultados Dinámico (Analítico y Condensado)
router.get('/estado-resultados', async (req, res) => {
  try {
    // 1. Ingresos (Código 5 / Tipo 5)
    const [ingresosRows] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, 
              COALESCE(SUM(d.debe), 0) AS total_debe, 
              COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.tipo = 5 OR c.codigo LIKE '5%'
       GROUP BY c.id, c.codigo, c.nombre
       HAVING (total_debe > 0 OR total_haber > 0)
       ORDER BY c.codigo ASC`
    );

    let totalIngresos = 0;
    const ingresos = [];
    ingresosRows.forEach(c => {
      const debe = parseFloat(c.total_debe);
      const haber = parseFloat(c.total_haber);
      const saldo = Math.round((haber - debe) * 100) / 100;
      if (Math.abs(saldo) >= 0.01) {
        totalIngresos += saldo;
        ingresos.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, saldo });
      }
    });

    // 2. Costos y Gastos (Código 4 / Tipo 4)
    const [gastosRows] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, 
              COALESCE(SUM(d.debe), 0) AS total_debe, 
              COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.tipo = 4 OR c.codigo LIKE '4%'
       GROUP BY c.id, c.codigo, c.nombre
       HAVING (total_debe > 0 OR total_haber > 0)
       ORDER BY c.codigo ASC`
    );

    let totalCostosGastos = 0;
    const costosGastos = [];
    gastosRows.forEach(c => {
      const debe = parseFloat(c.total_debe);
      const haber = parseFloat(c.total_haber);
      const saldo = Math.round((debe - haber) * 100) / 100;
      if (Math.abs(saldo) >= 0.01) {
        totalCostosGastos += saldo;
        costosGastos.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, saldo });
      }
    });

    // 3. CÁLCULO ANALÍTICO / PORMENORIZADO (4 COLUMNAS)
    const [movs] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza,
              d.debe, d.haber, p.numero_partida, p.concepto
       FROM catalogo_cuentas c
       INNER JOIN detalle_asiento d ON c.id = d.cuenta_id
       INNER JOIN partidas p ON d.partida_id = p.id
       ORDER BY c.codigo ASC, p.numero_partida ASC`
    );

    let ventasTotales = 0;
    const ventasDetalle = [];
    let rebajasDevVentas = 0;
    const rebajasDevVentasDetalle = [];

    let compras = 0;
    const comprasDetalle = [];
    let gastosCompras = 0;
    const gastosComprasDetalle = [];
    let rebajasDevCompras = 0;
    const rebajasDevComprasDetalle = [];

    let gastosVenta = 0;
    const gastosVentaDetalle = [];
    let gastosAdmin = 0;
    const gastosAdminDetalle = [];
    let gastosFinancieros = 0;
    const gastosFinancierosDetalle = [];

    let otrosIngresos = 0;
    let otrosGastos = 0;

    movs.forEach(m => {
      const debe = parseFloat(m.debe);
      const haber = parseFloat(m.haber);
      const esAjuste = m.concepto && m.concepto.toLowerCase().includes('ajuste');

      if (esCuentaDevVentas(m.codigo, m.nombre)) {
        const saldo = debe - haber;
        rebajasDevVentas += saldo;
        rebajasDevVentasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (esCuentaVentas(m.codigo, m.nombre)) {
        const saldo = haber - debe;
        ventasTotales += saldo;
        ventasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (esCuentaDevCompras(m.codigo, m.nombre)) {
        const saldo = haber - debe;
        rebajasDevCompras += saldo;
        rebajasDevComprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (esCuentaGastosCompras(m.codigo, m.nombre)) {
        const saldo = debe - haber;
        gastosCompras += saldo;
        gastosComprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (esCuentaCompras(m.codigo, m.nombre)) {
        if (!esAjuste) {
          const saldo = debe - haber;
          compras += saldo;
          comprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
        }
      } else if (m.codigo === '4202' || m.codigo.startsWith('4202')) {
        const saldo = debe - haber;
        gastosVenta += saldo;
        gastosVentaDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '4201' || m.codigo === '4204' || m.codigo.startsWith('4201') || m.codigo.startsWith('4204')) {
        const saldo = debe - haber;
        gastosAdmin += saldo;
        gastosAdminDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '4203' || m.codigo.startsWith('4203')) {
        const saldo = debe - haber;
        gastosFinancieros += saldo;
        gastosFinancierosDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '5102' || m.codigo === '5201') {
        otrosIngresos += (haber - debe);
      } else if (m.codigo === '4205' || m.codigo.startsWith('4205')) {
        otrosGastos += (debe - haber);
      }
    });

    // Inventario Inicial:
    let invInicial = 0;
    const [kInicial] = await db.query(`SELECT COALESCE(SUM(debe), 0) as total FROM kardex WHERE tipo_movimiento = 'INICIAL'`);
    invInicial = parseFloat(kInicial[0].total) || 0;

    if (invInicial === 0) {
      const [pInicial] = await db.query(
        `SELECT COALESCE(SUM(d.debe), 0) as total
         FROM detalle_asiento d
         JOIN partidas p ON d.partida_id = p.id
         JOIN catalogo_cuentas c ON d.cuenta_id = c.id
         WHERE c.codigo = '1103' AND (p.numero_partida = 1 OR LOWER(p.concepto) LIKE '%inicio%' OR LOWER(p.concepto) LIKE '%apertura%')`
      );
      invInicial = parseFloat(pInicial[0].total) || 0;
    }

    if (invInicial === 0) {
      const [aj1] = await db.query(
        `SELECT COALESCE(SUM(d.haber), 0) as total
         FROM detalle_asiento d
         JOIN partidas p ON d.partida_id = p.id
         JOIN catalogo_cuentas c ON d.cuenta_id = c.id
         WHERE c.codigo = '1103' AND LOWER(p.concepto) LIKE '%ajuste 1%'`
      );
      invInicial = parseFloat(aj1[0].total) || 0;
    }

    // Inventario Final:
    let invFinal = 0;
    const [aj2] = await db.query(
      `SELECT COALESCE(SUM(d.debe), 0) as total
       FROM detalle_asiento d
       JOIN partidas p ON d.partida_id = p.id
       JOIN catalogo_cuentas c ON d.cuenta_id = c.id
       WHERE c.codigo = '1103' AND LOWER(p.concepto) LIKE '%ajuste 2%'`
    );
    invFinal = parseFloat(aj2[0].total) || 0;

    if (invFinal === 0) {
      const [kFinal] = await db.query(`SELECT saldo FROM kardex ORDER BY id DESC LIMIT 1`);
      if (kFinal.length > 0) invFinal = parseFloat(kFinal[0].saldo) || 0;
    }

    if (invFinal === 0) {
      const [inv1103] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) as total
         FROM detalle_asiento d
         JOIN catalogo_cuentas c ON d.cuenta_id = c.id
         WHERE c.codigo = '1103'`
      );
      invFinal = parseFloat(inv1103[0].total) || 0;
    }

    // Fórmulas analíticas estándar:
    const ventasNetas = Math.round((ventasTotales - rebajasDevVentas) * 100) / 100;
    const comprasTotales = Math.round((compras + gastosCompras) * 100) / 100;
    const comprasNetas = Math.round((comprasTotales - rebajasDevCompras) * 100) / 100;
    const mercanciaDisponible = Math.round((invInicial + comprasNetas) * 100) / 100;
    
    let costoVentas = Math.round((mercanciaDisponible - invFinal) * 100) / 100;
    if (costoVentas <= 0 && mercanciaDisponible === 0) {
      const [costoDirecto] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) as total
         FROM detalle_asiento d
         JOIN catalogo_cuentas c ON d.cuenta_id = c.id
         WHERE c.codigo = '4101'`
      );
      costoVentas = parseFloat(costoDirecto[0].total) || 0;
    }

    const utilidadBruta = Math.round((ventasNetas - costoVentas) * 100) / 100;
    const totalGastosOperacion = Math.round((gastosVenta + gastosAdmin + gastosFinancieros) * 100) / 100;
    const utilidadOperacion = Math.round((utilidadBruta - totalGastosOperacion) * 100) / 100;
    const utilidadAntesImpuestos = Math.round((utilidadOperacion + otrosIngresos - otrosGastos) * 100) / 100;
    const utilidadNeta = utilidadAntesImpuestos;

    // Para la vista condensada y compatibilidad general:
    totalIngresos = Math.round((ventasNetas + otrosIngresos) * 100) / 100;
    totalCostosGastos = Math.round((costoVentas + totalGastosOperacion + otrosGastos) * 100) / 100;
    const utilidadEjercicio = Math.round((totalIngresos - totalCostosGastos) * 100) / 100;

    const analitico = {
      ventasTotales,
      ventasDetalle,
      rebajasDevVentas,
      rebajasDevVentasDetalle,
      ventasNetas,
      invInicial,
      compras,
      comprasDetalle,
      gastosCompras,
      gastosComprasDetalle,
      comprasTotales,
      rebajasDevCompras,
      rebajasDevComprasDetalle,
      comprasNetas,
      mercanciaDisponible,
      invFinal,
      costoVentas,
      utilidadBruta,
      gastosVenta,
      gastosVentaDetalle,
      gastosAdmin,
      gastosAdminDetalle,
      gastosFinancieros,
      gastosFinancierosDetalle,
      totalGastosOperacion,
      utilidadOperacion,
      otrosIngresos,
      otrosGastos,
      utilidadAntesImpuestos,
      utilidadNeta,
      esUtilidad: utilidadOperacion >= 0
    };

    res.json({
      success: true,
      ingresos,
      totalIngresos,
      costosGastos,
      totalCostosGastos,
      utilidadEjercicio,
      esUtilidad: utilidadEjercicio >= 0,
      analitico
    });

  } catch (error) {
    console.error('Error en Estado de Resultados:', error);
    res.status(500).json({ success: false, message: 'Error al calcular Estado de Resultados.', error: error.message });
  }
});

// GET /api/reportes/balance-general - Balance General Dinámico
router.get('/balance-general', async (req, res) => {
  try {
    const [ajustesCount] = await db.query(
      `SELECT COUNT(*) as total FROM partidas WHERE LOWER(concepto) LIKE '%ajuste%'`
    );
    const tieneAjustes = ajustesCount[0].total > 0;

    // 1. Activos (Código 1 / Tipo 1)
    const [activosRows] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, 
              COALESCE(SUM(d.debe), 0) AS total_debe, 
              COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.tipo = 1 OR c.codigo LIKE '1%'
       GROUP BY c.id, c.codigo, c.nombre
       HAVING (total_debe > 0 OR total_haber > 0)
       ORDER BY c.codigo ASC`
    );

    let totalActivos = 0;
    const activos = [];

    let invFinalKardex = 0;
    if (!tieneAjustes) {
      const [kFinal] = await db.query(`SELECT saldo FROM kardex ORDER BY id DESC LIMIT 1`);
      if (kFinal.length > 0) invFinalKardex = parseFloat(kFinal[0].saldo) || 0;
    }

    activosRows.forEach(c => {
      let saldo = Math.round((parseFloat(c.total_debe) - parseFloat(c.total_haber)) * 100) / 100;
      if (!tieneAjustes && c.codigo === '1103' && invFinalKardex > 0) {
        saldo = invFinalKardex;
      }
      if (Math.abs(saldo) >= 0.01) {
        totalActivos += saldo;
        activos.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, saldo });
      }
    });

    // 2. Pasivos (Código 2 / Tipo 2)
    const [pasivosRows] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, 
              COALESCE(SUM(d.debe), 0) AS total_debe, 
              COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.tipo = 2 OR c.codigo LIKE '2%'
       GROUP BY c.id, c.codigo, c.nombre
       HAVING (total_debe > 0 OR total_haber > 0)
       ORDER BY c.codigo ASC`
    );

    let totalPasivos = 0;
    const pasivos = [];
    pasivosRows.forEach(c => {
      const saldo = Math.round((parseFloat(c.total_haber) - parseFloat(c.total_debe)) * 100) / 100;
      if (Math.abs(saldo) >= 0.01) {
        totalPasivos += saldo;
        pasivos.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, saldo });
      }
    });

    // 3. Capital Contable (Código 3 / Tipo 3)
    const [capitalRows] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, 
              COALESCE(SUM(d.debe), 0) AS total_debe, 
              COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       WHERE c.tipo = 3 OR c.codigo LIKE '3%'
       GROUP BY c.id, c.codigo, c.nombre
       HAVING (total_debe > 0 OR total_haber > 0)
       ORDER BY c.codigo ASC`
    );

    let totalCapital = 0;
    const capital = [];
    capitalRows.forEach(c => {
      const saldo = Math.round((parseFloat(c.total_haber) - parseFloat(c.total_debe)) * 100) / 100;
      if (Math.abs(saldo) >= 0.01) {
        totalCapital += saldo;
        capital.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, saldo });
      }
    });

    // 4. Utilidad o Pérdida del Ejercicio (calculada analíticamente para coincidencia exacta al centavo)
    const [movs] = await db.query(
      `SELECT c.id, c.codigo, c.nombre, c.tipo, c.naturaleza,
              d.debe, d.haber, p.numero_partida, p.concepto
       FROM catalogo_cuentas c
       INNER JOIN detalle_asiento d ON c.id = d.cuenta_id
       INNER JOIN partidas p ON d.partida_id = p.id`
    );

    let vTot = 0, rDevVentas = 0, comp = 0, gComp = 0, rDevComp = 0;
    let gVentas = 0, gAdm = 0, gFin = 0, oIng = 0, oGastos = 0;

    movs.forEach(m => {
      const debe = parseFloat(m.debe);
      const haber = parseFloat(m.haber);
      const esAjuste = m.concepto && m.concepto.toLowerCase().includes('ajuste');

      if (esCuentaDevVentas(m.codigo, m.nombre)) {
        rDevVentas += (debe - haber);
      } else if (esCuentaVentas(m.codigo, m.nombre)) {
        vTot += (haber - debe);
      } else if (esCuentaDevCompras(m.codigo, m.nombre)) {
        rDevComp += (haber - debe);
      } else if (esCuentaGastosCompras(m.codigo, m.nombre)) {
        gComp += (debe - haber);
      } else if (esCuentaCompras(m.codigo, m.nombre)) {
        if (!esAjuste) comp += (debe - haber);
      } else if (m.codigo === '4202' || m.codigo.startsWith('4202')) {
        gVentas += (debe - haber);
      } else if (m.codigo === '4201' || m.codigo === '4204' || m.codigo.startsWith('4201') || m.codigo.startsWith('4204')) {
        gAdm += (debe - haber);
      } else if (m.codigo === '4203' || m.codigo.startsWith('4203')) {
        gFin += (debe - haber);
      } else if (m.codigo === '5102' || m.codigo === '5201') {
        oIng += (haber - debe);
      } else if (m.codigo === '4205' || m.codigo.startsWith('4205')) {
        oGastos += (debe - haber);
      }
    });

    let iIni = 0;
    const [kInicial] = await db.query(`SELECT COALESCE(SUM(debe), 0) as total FROM kardex WHERE tipo_movimiento = 'INICIAL'`);
    iIni = parseFloat(kInicial[0].total) || 0;
    if (iIni === 0) {
      const [aj1] = await db.query(`SELECT COALESCE(SUM(d.haber), 0) as total FROM detalle_asiento d JOIN partidas p ON d.partida_id = p.id JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '1103' AND LOWER(p.concepto) LIKE '%ajuste 1%'`);
      iIni = parseFloat(aj1[0].total) || 0;
    }

    let iFin = 0;
    const [aj2] = await db.query(`SELECT COALESCE(SUM(d.debe), 0) as total FROM detalle_asiento d JOIN partidas p ON d.partida_id = p.id JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '1103' AND LOWER(p.concepto) LIKE '%ajuste 2%'`);
    iFin = parseFloat(aj2[0].total) || 0;
    if (iFin === 0) {
      const [kFinal] = await db.query(`SELECT saldo FROM kardex ORDER BY id DESC LIMIT 1`);
      if (kFinal.length > 0) iFin = parseFloat(kFinal[0].saldo) || 0;
    }

    const vNet = vTot - rDevVentas;
    const cNet = (comp + gComp) - rDevComp;
    const mDisp = iIni + cNet;
    const cVentas = mDisp - iFin;
    const uBrut = vNet - cVentas;
    const gOp = gVentas + gAdm + gFin;
    const utilidadEjercicio = Math.round((uBrut - gOp + oIng - oGastos) * 100) / 100;

    totalActivos = Math.round(totalActivos * 100) / 100;
    totalPasivos = Math.round(totalPasivos * 100) / 100;
    totalCapital = Math.round(totalCapital * 100) / 100;

    const totalPasivoCapital = Math.round((totalPasivos + totalCapital + utilidadEjercicio) * 100) / 100;
    const estaCuadrado = Math.abs(totalActivos - totalPasivoCapital) < 0.01;

    res.json({
      success: true,
      activos,
      totalActivos,
      pasivos,
      totalPasivos,
      capital,
      totalCapital,
      utilidadEjercicio,
      totalPasivoCapital,
      estaCuadrado,
      diferencia: Math.round(Math.abs(totalActivos - totalPasivoCapital) * 100) / 100,
      tieneAjustes,
      modo: tieneAjustes ? 'sin_inventarios' : 'con_inventarios'
    });

  } catch (error) {
    console.error('Error en Balance General:', error);
    res.status(500).json({ success: false, message: 'Error al calcular Balance General.', error: error.message });
  }
});

// GET /api/reportes/modo-inventario - Consultar el modo activo
router.get('/modo-inventario', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, numero_partida, concepto FROM partidas WHERE LOWER(concepto) LIKE '%ajuste%'`
    );
    const tieneAjustes = rows.length > 0;
    res.json({
      success: true,
      modo: tieneAjustes ? 'sin_inventarios' : 'con_inventarios',
      tieneAjustes,
      totalAjustes: rows.length,
      partidasAjuste: rows
    });
  } catch (error) {
    console.error('Error al consultar modo inventario:', error);
    res.status(500).json({ success: false, message: 'Error al consultar modo de inventario.', error: error.message });
  }
});

// POST /api/reportes/modo-inventario - Cambiar modo (Con Inventarios vs Sin Inventarios)
router.post('/modo-inventario', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { modo } = req.body; // 'con_inventarios' | 'sin_inventarios'

    if (modo !== 'con_inventarios' && modo !== 'sin_inventarios') {
      return res.status(400).json({ success: false, message: 'Modo inválido. Debe ser "con_inventarios" o "sin_inventarios".' });
    }

    await connection.beginTransaction();

    if (modo === 'con_inventarios') {
      // Modo CON INVENTARIOS:
      // Se eliminan los asientos de ajuste para no afectar el Libro Mayor ni el Libro Diario.
      // El Estado de Resultados calcula automáticamente desde Kardex.
      const [ajustes] = await connection.query(
        `SELECT id FROM partidas WHERE LOWER(concepto) LIKE '%ajuste%'`
      );

      if (ajustes.length > 0) {
        const ids = ajustes.map(a => a.id);
        await connection.query(`DELETE FROM detalle_asiento WHERE partida_id IN (?)`, [ids]);
        await connection.query(`DELETE FROM partidas WHERE id IN (?)`, [ids]);

        // Renumerar correlativamente las partidas restantes
        const [restantes] = await connection.query(
          `SELECT id FROM partidas ORDER BY numero_partida ASC, id ASC`
        );
        for (let i = 0; i < restantes.length; i++) {
          await connection.query(`UPDATE partidas SET numero_partida = ? WHERE id = ?`, [i + 1, restantes[i].id]);
        }
      }

      await connection.commit();
      return res.json({
        success: true,
        modo: 'con_inventarios',
        message: 'Modo "Con Inventarios" activado: Los inventarios se calculan automáticamente en el Estado de Resultados sin asientos en el Libro Mayor.'
      });

    } else {
      // Modo SIN INVENTARIOS:
      // Se generan automáticamente los 2 asientos de ajuste en el Libro Diario y Mayor:
      // Asiento 1: Compras (Debe) / Inventarios (Haber) por Inv. Inicial
      // Asiento 2: Inventarios (Debe) / Compras (Haber) por Inv. Final
      const [ajustesExistentes] = await connection.query(
        `SELECT id FROM partidas WHERE LOWER(concepto) LIKE '%ajuste%'`
      );

      if (ajustesExistentes.length > 0) {
        await connection.rollback();
        return res.json({
          success: true,
          modo: 'sin_inventarios',
          message: 'Los asientos de ajuste de inventarios ya están registrados en el Libro Diario y Mayor.'
        });
      }

      // Obtener Inventario Inicial
      let invInicial = 0;
      const [kInicial] = await connection.query(`SELECT COALESCE(SUM(debe), 0) as total FROM kardex WHERE tipo_movimiento = 'INICIAL'`);
      invInicial = parseFloat(kInicial[0].total) || 0;

      if (invInicial === 0) {
        const [pInicial] = await connection.query(
          `SELECT COALESCE(SUM(d.debe), 0) as total
           FROM detalle_asiento d
           JOIN partidas p ON d.partida_id = p.id
           JOIN catalogo_cuentas c ON d.cuenta_id = c.id
           WHERE c.codigo = '1103' AND (p.numero_partida = 1 OR LOWER(p.concepto) LIKE '%inicio%' OR LOWER(p.concepto) LIKE '%apertura%')`
        );
        invInicial = parseFloat(pInicial[0].total) || 0;
      }

      // Obtener Inventario Final de Kardex
      let invFinal = 0;
      const [kFinal] = await connection.query(`SELECT saldo FROM kardex ORDER BY id DESC LIMIT 1`);
      if (kFinal.length > 0) invFinal = parseFloat(kFinal[0].saldo) || 0;

      if (invFinal === 0) {
        const [inv1103] = await connection.query(
          `SELECT COALESCE(SUM(d.debe - d.haber), 0) as total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '1103'`
        );
        invFinal = parseFloat(inv1103[0].total) || 0;
      }

      // Cuentas contables necesarias
      const [cuentas] = await connection.query(
        `SELECT id, codigo FROM catalogo_cuentas WHERE codigo IN ('1103', '4102')`
      );
      const cuentaMap = {};
      cuentas.forEach(c => { cuentaMap[c.codigo] = c.id; });

      if (!cuentaMap['1103'] || !cuentaMap['4102']) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Faltan las cuentas 1103 (Inventarios) o 4102 (Compras) en el catálogo.' });
      }

      const [maxRow] = await connection.query(`SELECT COALESCE(MAX(numero_partida), 0) AS max_num FROM partidas`);
      let numPartida = maxRow[0].max_num + 1;
      const fechaAjuste = new Date().toISOString().split('T')[0];

      // Asiento 1: Compras / Inventarios (Traspaso Inventario Inicial)
      if (invInicial > 0) {
        const [p1] = await connection.query(
          `INSERT INTO partidas (numero_partida, fecha, concepto) VALUES (?, ?, ?)`,
          [numPartida, fechaAjuste, `Ajuste 1: Traspaso del Inventario Inicial ($${invInicial.toFixed(2)}) a la cuenta Compras para determinar la Mercancía Disponible para la venta.`]
        );
        await connection.query(
          `INSERT INTO detalle_asiento (partida_id, cuenta_id, parcial, debe, haber) VALUES 
           (?, ?, 0.00, ?, 0.00),
           (?, ?, 0.00, 0.00, ?)`,
          [p1.insertId, cuentaMap['4102'], invInicial, p1.insertId, cuentaMap['1103'], invInicial]
        );
        numPartida++;
      }

      // Asiento 2: Inventarios / Compras (Registro Inventario Final)
      if (invFinal > 0) {
        const [p2] = await connection.query(
          `INSERT INTO partidas (numero_partida, fecha, concepto) VALUES (?, ?, ?)`,
          [numPartida, fechaAjuste, `Ajuste 2: Registro del Inventario Final físico ($${invFinal.toFixed(2)}) deduciéndolo de Compras para determinar el Costo de Venta.`]
        );
        await connection.query(
          `INSERT INTO detalle_asiento (partida_id, cuenta_id, parcial, debe, haber) VALUES 
           (?, ?, 0.00, ?, 0.00),
           (?, ?, 0.00, 0.00, ?)`,
          [p2.insertId, cuentaMap['1103'], invFinal, p2.insertId, cuentaMap['4102'], invFinal]
        );
        numPartida++;
      }

      await connection.commit();
      return res.json({
        success: true,
        modo: 'sin_inventarios',
        message: 'Modo "Sin Inventarios" activado: Se crearon automáticamente los asientos de ajuste (Compras/Inventarios e Inventarios/Compras) en el Libro Diario y Mayor.'
      });
    }

  } catch (error) {
    await connection.rollback();
    console.error('Error al cambiar modo de inventarios:', error);
    res.status(500).json({ success: false, message: 'Error interno al cambiar modo de inventarios.', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;

