const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reportes/mayor - Consolidación del Libro Mayor en Tiempo Real
router.get('/mayor', async (req, res) => {
  try {
    const [cuentas] = await db.query(
      `SELECT 
        c.id, 
        c.codigo, 
        c.nombre, 
        c.tipo, 
        c.naturaleza,
        COALESCE(SUM(d.debe), 0) AS total_debe,
        COALESCE(SUM(d.haber), 0) AS total_haber
       FROM catalogo_cuentas c
       LEFT JOIN detalle_asiento d ON c.id = d.cuenta_id
       GROUP BY c.id, c.codigo, c.nombre, c.tipo, c.naturaleza
       ORDER BY c.codigo ASC`
    );

    const libroMayor = [];

    for (let c of cuentas) {
      const debe = parseFloat(c.total_debe);
      const haber = parseFloat(c.total_haber);
      let saldo = 0;

      // Determinación del saldo según su naturaleza:
      // Cuentas deudoras (Activos, Costos, Gastos): Saldo = Debe - Haber
      // Cuentas acreedoras (Pasivos, Capital, Ingresos): Saldo = Haber - Debe
      if (c.naturaleza === 'DEUDORA') {
        saldo = debe - haber;
      } else {
        saldo = haber - debe;
      }

      // Obtener los movimientos individuales para la vista detallada en T
      const [movimientos] = await db.query(
        `SELECT p.numero_partida, p.fecha, p.concepto, d.debe, d.haber
         FROM detalle_asiento d
         INNER JOIN partidas p ON d.partida_id = p.id
         WHERE d.cuenta_id = ?
         ORDER BY p.fecha ASC, p.numero_partida ASC`,
        [c.id]
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

// GET /api/reportes/estado-resultados - Estado de Resultados Dinámico (Analítico y Condensado)
router.get('/estado-resultados', async (req, res) => {
  try {
    // 1. Ingresos (Código 5 / Tipo 5) - Naturaleza ACREEDORA (Saldo = Haber - Debe)
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

    // 2. Costos y Gastos (Código 4 / Tipo 4) - Naturaleza DEUDORA (Saldo = Debe - Haber)
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

    totalIngresos = Math.round(totalIngresos * 100) / 100;
    totalCostosGastos = Math.round(totalCostosGastos * 100) / 100;
    const utilidadEjercicio = Math.round((totalIngresos - totalCostosGastos) * 100) / 100;

    // ==========================================
    // 3. CÁLCULO ANALÍTICO / PORMENORIZADO (4 COLUMNAS)
    // ==========================================
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

      if (m.codigo === '5101' || m.codigo === '5104' || (m.codigo.startsWith('51') && m.codigo !== '5102' && m.codigo !== '5103')) {
        const saldo = haber - debe;
        ventasTotales += saldo;
        ventasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '5103' || m.nombre.toLowerCase().includes('devoluciones y rebajas sobre venta')) {
        const saldo = debe - haber;
        rebajasDevVentas += saldo;
        rebajasDevVentasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '4102') {
        if (!esAjuste) {
          const saldo = debe - haber;
          compras += saldo;
          comprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
        }
      } else if (m.codigo === '4103') {
        const saldo = debe - haber;
        gastosCompras += saldo;
        gastosComprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
      } else if (m.codigo === '4104') {
        const saldo = haber - debe;
        rebajasDevCompras += saldo;
        rebajasDevComprasDetalle.push({ cuenta: m.nombre, partida: m.numero_partida, concepto: m.concepto, saldo });
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
    
    // Si no hay compras ni inventario pero hay cuenta Costo de Ventas directa (4101):
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
      // Formato condensado (compatible)
      ingresos,
      totalIngresos,
      costosGastos,
      totalCostosGastos,
      utilidadEjercicio,
      esUtilidad: utilidadEjercicio >= 0,
      // Formato analítico pormenorizado (4 columnas)
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
    // 1. Activos (Código 1 / Tipo 1) - Deudora (Saldo = Debe - Haber)
    // Determinar si hay asientos de ajuste en el Libro Diario
    const [ajustesCount] = await db.query(
      `SELECT COUNT(*) as total FROM partidas WHERE LOWER(concepto) LIKE '%ajuste%'`
    );
    const tieneAjustes = ajustesCount[0].total > 0;

    // 1. Activos (Código 1 / Tipo 1) - Deudora (Saldo = Debe - Haber)
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

    // Si estamos en modo "con_inventarios" (sin asientos de ajuste en el mayor),
    // el saldo de inventarios en el Balance General debe reflejar el Inventario Final físico del Kardex
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

    // 2. Pasivos (Código 2 / Tipo 2) - Acreedora (Saldo = Haber - Debe)
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

    // 3. Capital Contable (Código 3 / Tipo 3) - Acreedora (Saldo = Haber - Debe)
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

    // 4. Utilidad o Pérdida del Ejercicio
    let utilidadEjercicio = 0;

    if (tieneAjustes) {
      const [ingresosTotales] = await db.query(
        `SELECT COALESCE(SUM(d.haber - d.debe), 0) AS total 
         FROM detalle_asiento d 
         INNER JOIN catalogo_cuentas c ON d.cuenta_id = c.id 
         WHERE c.tipo = 5 OR c.codigo LIKE '5%'`
      );
      const [gastosTotales] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) AS total 
         FROM detalle_asiento d 
         INNER JOIN catalogo_cuentas c ON d.cuenta_id = c.id 
         WHERE c.tipo = 4 OR c.codigo LIKE '4%'`
      );
      utilidadEjercicio = Math.round((parseFloat(ingresosTotales[0].total) - parseFloat(gastosTotales[0].total)) * 100) / 100;
    } else {
      // Si no hay ajustes de inventario en el diario, la utilidad es la utilidad analítica calculada
      // Ventas Netas - Costo de Ventas (Kardex) - Gastos de Operación
      const [ventasRows] = await db.query(
        `SELECT COALESCE(SUM(d.haber - d.debe), 0) AS total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo IN ('5101', '5104')`
      );
      const [devVentasRows] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) AS total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '5103'`
      );
      const [comprasRows] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) AS total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '4102'`
      );
      const [devComprasRows] = await db.query(
        `SELECT COALESCE(SUM(d.haber - d.debe), 0) AS total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo = '4104'`
      );
      const [kInicial] = await db.query(`SELECT COALESCE(SUM(debe), 0) as total FROM kardex WHERE tipo_movimiento = 'INICIAL'`);
      const [kFinal] = await db.query(`SELECT saldo FROM kardex ORDER BY id DESC LIMIT 1`);
      const [gastosOp] = await db.query(
        `SELECT COALESCE(SUM(d.debe - d.haber), 0) AS total FROM detalle_asiento d JOIN catalogo_cuentas c ON d.cuenta_id = c.id WHERE c.codigo IN ('4201', '4202', '4203', '4204')`
      );

      const vNetas = (parseFloat(ventasRows[0].total) || 0) - (parseFloat(devVentasRows[0].total) || 0);
      const cNetas = (parseFloat(comprasRows[0].total) || 0) - (parseFloat(devComprasRows[0].total) || 0);
      const iIni = (parseFloat(kInicial[0].total) || 0);
      const iFin = kFinal.length > 0 ? (parseFloat(kFinal[0].saldo) || 0) : 0;
      const costo = (iIni + cNetas) - iFin;
      const uBruta = vNetas - costo;
      const gOp = parseFloat(gastosOp[0].total) || 0;
      utilidadEjercicio = Math.round((uBruta - gOp) * 100) / 100;
    }

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
      tieneAjustes,
      modo: tieneAjustes ? 'sin_inventarios' : 'con_inventarios'
    });

  } catch (error) {
    console.error('Error en Balance General:', error);
    res.status(500).json({ success: false, message: 'Error al generar Balance General.', error: error.message });
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

