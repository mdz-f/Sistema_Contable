// Lógica para Generación Dinámica de Estados Financieros

document.addEventListener('DOMContentLoaded', async () => {
  const session = checkAuthRequirement();
  if (!session) return;

  const fechaActual = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  document.getElementById('erFechaLabel').textContent = `Al ${fechaActual} (Expresado en $ USD)`;
  document.getElementById('bgFechaLabel').textContent = `Al ${fechaActual} (Expresado en $ USD)`;

  await consultarModoInventario();
  await cargarEstadoResultados();
  await cargarBalanceGeneral();

  const btnLiquidarIVA = document.getElementById('btnLiquidarIVAEstados');
  if (btnLiquidarIVA) {
    btnLiquidarIVA.addEventListener('click', async () => {
      if (!confirm('¿Deseas registrar automáticamente el Asiento de Liquidación de IVA del periodo en el Libro Diario?')) return;
      try {
        const res = await fetch('/api/partidas/liquidar-iva', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message);
          await cargarEstadoResultados();
          await cargarBalanceGeneral();
        } else {
          alert(data.message || 'Atención: No se pudo liquidar el IVA.');
        }
      } catch (err) {
        console.error('Error al liquidar IVA:', err);
        alert('Error de conexión al procesar la liquidación de IVA.');
      }
    });
  }
});

// Consultar modo de inventario (Con Inventarios vs Sin Inventarios)
async function consultarModoInventario() {
  try {
    const res = await fetch('/api/reportes/modo-inventario');
    const data = await res.json();
    if (!data.success) return;

    const badge = document.getElementById('badgeModoInventario');
    const btnCon = document.getElementById('btnModoConInv');
    const btnSin = document.getElementById('btnModoSinInv');
    const desc = document.getElementById('descModoInventario');

    if (data.modo === 'con_inventarios') {
      if (badge) badge.innerHTML = '<span class="text-success"><i class="bi bi-magic me-1"></i> Con Inventarios (Auto en reporte)</span>';
      if (desc) desc.textContent = 'Los inventarios se calculan en el Estado de Resultados. El Libro Mayor no tiene partidas de ajuste (está limpio).';
      if (btnCon) {
        btnCon.className = 'btn btn-sm btn-success text-white fw-semibold px-3 py-2 text-start shadow-sm';
        const sub = btnCon.querySelector('div');
        if (sub) sub.className = 'small fw-normal text-white-50';
      }
      if (btnSin) {
        btnSin.className = 'btn btn-sm btn-outline-primary fw-semibold px-3 py-2 text-start';
        const sub = btnSin.querySelector('div');
        if (sub) sub.className = 'small fw-normal text-muted';
      }
    } else {
      if (badge) badge.innerHTML = '<span class="text-primary"><i class="bi bi-journal-check me-1"></i> Sin Inventarios (Asientos en Diario/Mayor)</span>';
      if (desc) desc.textContent = 'Se registraron los asientos de ajuste en el Libro Diario y se reflejan en las cuentas T del Libro Mayor.';
      if (btnCon) {
        btnCon.className = 'btn btn-sm btn-outline-success fw-semibold px-3 py-2 text-start';
        const sub = btnCon.querySelector('div');
        if (sub) sub.className = 'small fw-normal text-muted';
      }
      if (btnSin) {
        btnSin.className = 'btn btn-sm btn-primary text-white fw-semibold px-3 py-2 text-start shadow-sm';
        const sub = btnSin.querySelector('div');
        if (sub) sub.className = 'small fw-normal text-white-50';
      }
    }
  } catch (err) {
    console.error('Error al consultar modo inventario:', err);
  }
}

// Aplicar cambio de modo de inventario
async function aplicarModoInventarios(nuevoModo) {
  const btnCon = document.getElementById('btnModoConInv');
  const btnSin = document.getElementById('btnModoSinInv');

  try {
    if (btnCon) btnCon.disabled = true;
    if (btnSin) btnSin.disabled = true;

    const res = await fetch('/api/reportes/modo-inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: nuevoModo })
    });
    const data = await res.json();

    if (data.success) {
      await consultarModoInventario();
      await cargarEstadoResultados();
      await cargarBalanceGeneral();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    console.error('Error al aplicar modo:', err);
    alert('Ocurrió un error al cambiar el modo de inventario.');
  } finally {
    if (btnCon) btnCon.disabled = false;
    if (btnSin) btnSin.disabled = false;
  }
}


// Variable global para almacenar datos del Estado de Resultados
let datosERGlobal = null;
let vistaERActual = localStorage.getItem('vista_er') || 'analitica';

// Función para cambiar de vista (Analítica vs Condensada)
function cambiarVistaER(vista) {
  vistaERActual = vista;
  localStorage.setItem('vista_er', vista);

  const btnAnalitica = document.getElementById('btnVistaAnalitica');
  const btnCondensada = document.getElementById('btnVistaCondensada');
  const subtitulo = document.getElementById('erTituloDoc');

  if (vista === 'analitica') {
    if (btnAnalitica) {
      btnAnalitica.className = 'btn btn-sm btn-primary rounded-pill px-3 fw-semibold shadow-sm';
    }
    if (btnCondensada) {
      btnCondensada.className = 'btn btn-sm btn-light rounded-pill px-3 fw-semibold text-muted';
    }
    if (subtitulo) subtitulo.textContent = 'ESTADO DE RESULTADOS ANALÍTICO (PORMENORIZADO)';
    if (datosERGlobal && datosERGlobal.analitico) {
      renderizarAnalitico(datosERGlobal.analitico);
    }
  } else {
    if (btnAnalitica) {
      btnAnalitica.className = 'btn btn-sm btn-light rounded-pill px-3 fw-semibold text-muted';
    }
    if (btnCondensada) {
      btnCondensada.className = 'btn btn-sm btn-primary rounded-pill px-3 fw-semibold shadow-sm';
    }
    if (subtitulo) subtitulo.textContent = 'ESTADO DE RESULTADOS CONDENSADO';
    if (datosERGlobal) {
      renderizarCondensado(datosERGlobal);
    }
  }
}

// Formateador de moneda USD
function fmtMoneda(val) {
  if (val === undefined || val === null || isNaN(val)) return '$0.00';
  const num = parseFloat(val);
  const esNegativo = num < 0;
  const absFormatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return esNegativo ? `-$${absFormatted}` : `$${absFormatted}`;
}

// 1. Cargar y Renderizar Estado de Resultados
async function cargarEstadoResultados() {
  const container = document.getElementById('erContainer');
  try {
    const res = await fetch('/api/reportes/estado-resultados');
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar Estado de Resultados: ${data.message || ''}</div>`;
      return;
    }

    datosERGlobal = data;

    // Renderizar según la preferencia activa
    if (vistaERActual === 'analitica' && data.analitico) {
      cambiarVistaER('analitica');
    } else {
      cambiarVistaER('condensada');
    }

  } catch (err) {
    console.error('Error ER:', err);
    container.innerHTML = `<div class="alert alert-danger">Error de conexión al obtener Estado de Resultados.</div>`;
  }
}

// Renderizado de la Vista Analítica (4 Columnas)
function renderizarAnalitico(a) {
  const container = document.getElementById('erContainer');
  if (!a) {
    container.innerHTML = `<div class="alert alert-warning">No hay datos suficientes para el formato analítico.</div>`;
    return;
  }

  const margenBrutoPct = a.ventasNetas > 0 ? ((a.utilidadBruta / a.ventasNetas) * 100).toFixed(1) : 0;
  const badgeUtilidadOperacion = a.utilidadOperacion >= 0 ? 'text-success' : 'text-danger';
  const labelUtilidadOperacion = a.utilidadOperacion >= 0 ? 'UTILIDAD DE OPERACIÓN' : 'PÉRDIDA DE OPERACIÓN';
  const badgeUtilidadNeta = a.utilidadNeta >= 0 ? 'text-success' : 'text-danger';
  const labelUtilidadNeta = a.utilidadNeta >= 0 ? 'UTILIDAD NETA DEL EJERCICIO' : 'PÉRDIDA NETA DEL EJERCICIO';

  // Detalle desplegable de sub-gastos si existen
  let rowsGastosVentaDetalle = '';
  if (a.gastosVentaDetalle && a.gastosVentaDetalle.length > 0) {
    a.gastosVentaDetalle.forEach(g => {
      rowsGastosVentaDetalle += `
        <tr class="text-muted small">
          <td class="ps-4 italic">• Partida #${g.partida}: ${g.concepto || g.cuenta}</td>
          <td class="col-monto">${fmtMoneda(g.saldo)}</td>
          <td></td><td></td><td></td>
        </tr>`;
    });
  }

  let rowsGastosAdminDetalle = '';
  if (a.gastosAdminDetalle && a.gastosAdminDetalle.length > 0) {
    a.gastosAdminDetalle.forEach(g => {
      rowsGastosAdminDetalle += `
        <tr class="text-muted small">
          <td class="ps-4 italic">• Partida #${g.partida}: ${g.concepto || g.cuenta}</td>
          <td class="col-monto">${fmtMoneda(g.saldo)}</td>
          <td></td><td></td><td></td>
        </tr>`;
    });
  }

  let rowsGastosFinancierosDetalle = '';
  if (a.gastosFinancierosDetalle && a.gastosFinancierosDetalle.length > 0) {
    a.gastosFinancierosDetalle.forEach(g => {
      rowsGastosFinancierosDetalle += `
        <tr class="text-muted small">
          <td class="ps-4 italic">• Partida #${g.partida}: ${g.concepto || g.cuenta}</td>
          <td class="col-monto">${fmtMoneda(g.saldo)}</td>
          <td></td><td></td><td></td>
        </tr>`;
    });
  }

  container.innerHTML = `
    <!-- Tarjetas de Resumen Rápido -->
    <div class="row g-3 mb-4 no-print">
      <div class="col-6 col-md-3">
        <div class="card border-0 bg-primary bg-opacity-10 rounded-4 p-3 text-center">
          <div class="text-muted small fw-semibold">Ventas Netas</div>
          <div class="fs-5 fw-bold text-primary">${fmtMoneda(a.ventasNetas)}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 bg-warning bg-opacity-10 rounded-4 p-3 text-center">
          <div class="text-muted small fw-semibold">Costo de Ventas</div>
          <div class="fs-5 fw-bold text-warning-emphasis">${fmtMoneda(a.costoVentas)}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 bg-success bg-opacity-10 rounded-4 p-3 text-center">
          <div class="text-muted small fw-semibold">Utilidad Bruta (${margenBrutoPct}%)</div>
          <div class="fs-5 fw-bold text-success">${fmtMoneda(a.utilidadBruta)}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 bg-dark bg-opacity-10 rounded-4 p-3 text-center">
          <div class="text-muted small fw-semibold">Utilidad del Ejercicio</div>
          <div class="fs-5 fw-bold ${badgeUtilidadOperacion}">${fmtMoneda(a.utilidadOperacion)}</div>
        </div>
      </div>
    </div>

    <!-- Tabla Oficial de 4 Columnas -->
    <div class="table-responsive">
      <table class="table er-analitico-table align-middle shadow-sm rounded-3 overflow-hidden">
        <thead class="text-center align-middle">
          <tr>
            <th style="width: 44%;" class="text-start ps-3">CONCEPTO / CUENTA</th>
            <th style="width: 14%;">1</th>
            <th style="width: 14%;">2</th>
            <th style="width: 14%;">3</th>
            <th style="width: 14%;">4</th>
          </tr>
        </thead>
        <tbody>
          
          <!-- 1. VENTAS -->
          <tr class="row-header-group">
            <td colspan="5"><i class="bi bi-tag me-1 text-primary"></i> 1. DETERMINACIÓN DE LAS VENTAS NETAS</td>
          </tr>
          <tr>
            <td class="ps-3 fw-semibold">Ventas Totales</td>
            <td></td>
            <td></td>
            <td class="col-monto">${fmtMoneda(a.ventasTotales)}</td>
            <td></td>
          </tr>
          <tr>
            <td class="ps-4 text-muted">(-) Menos: Devoluciones y Rebajas sobre Ventas</td>
            <td></td>
            <td></td>
            <td class="col-monto text-muted">${fmtMoneda(a.rebajasDevVentas)}</td>
            <td></td>
          </tr>
          <tr class="row-principal">
            <td class="ps-3 fw-bold text-primary">(=) VENTAS NETAS</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="col-monto text-primary fw-bold fs-6">${fmtMoneda(a.ventasNetas)}</td>
          </tr>

          <!-- 2. COSTO DE VENTA -->
          <tr class="row-header-group mt-2">
            <td colspan="5"><i class="bi bi-box-seam me-1 text-warning"></i> 2. DETERMINACIÓN DEL COSTO DE LO VENDIDO</td>
          </tr>
          <tr>
            <td class="ps-3 fw-semibold">Inventario Inicial</td>
            <td></td>
            <td></td>
            <td class="col-monto">${fmtMoneda(a.invInicial)}</td>
            <td></td>
          </tr>
          <tr>
            <td class="ps-4">Compras</td>
            <td class="col-monto">${fmtMoneda(a.compras)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="ps-4 text-muted">(+) Más: Gastos sobre Compras</td>
            <td class="col-monto text-muted">${fmtMoneda(a.gastosCompras)}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr class="row-subtotal">
            <td class="ps-3 fw-semibold">(=) Compras Totales</td>
            <td></td>
            <td class="col-monto fw-semibold">${fmtMoneda(a.comprasTotales)}</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td class="ps-4 text-muted">(-) Menos: Devoluciones y Rebajas sobre Compras</td>
            <td></td>
            <td class="col-monto text-muted">${fmtMoneda(a.rebajasDevCompras)}</td>
            <td></td>
            <td></td>
          </tr>
          <tr class="row-subtotal">
            <td class="ps-3 fw-semibold">(=) Compras Netas</td>
            <td></td>
            <td></td>
            <td class="col-monto fw-semibold">${fmtMoneda(a.comprasNetas)}</td>
            <td></td>
          </tr>
          <tr class="table-info bg-opacity-25 fw-semibold">
            <td class="ps-3">(=) TOTAL MERCANCÍA DISPONIBLE</td>
            <td></td>
            <td></td>
            <td class="col-monto fw-bold text-info-emphasis">${fmtMoneda(a.mercanciaDisponible)}</td>
            <td></td>
          </tr>
          <tr>
            <td class="ps-4 text-muted">(-) Menos: Inventario Final</td>
            <td></td>
            <td></td>
            <td class="col-monto text-muted">${fmtMoneda(a.invFinal)}</td>
            <td></td>
          </tr>
          <tr class="table-warning bg-opacity-25 fw-bold">
            <td class="ps-3 text-warning-emphasis">(=) COSTO DE LO VENDIDO (COSTO DE VENTAS)</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="col-monto text-warning-emphasis fw-bold fs-6">${fmtMoneda(a.costoVentas)}</td>
          </tr>

          <!-- 3. UTILIDAD BRUTA -->
          <tr class="table-success bg-opacity-50 fw-bold border-top border-bottom border-2 border-success">
            <td class="ps-3 fs-6 text-success">(=) UTILIDAD BRUTA (Ventas Netas - Costo de Ventas)</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="col-monto text-success fw-bold fs-6">${fmtMoneda(a.utilidadBruta)}</td>
          </tr>

          <!-- 4. GASTOS DE OPERACIÓN -->
          <tr class="row-header-group">
            <td colspan="5"><i class="bi bi-wallet2 me-1 text-danger"></i> 3. GASTOS DE OPERACIÓN</td>
          </tr>
          <tr>
            <td class="ps-3 fw-semibold">Gastos de Venta</td>
            <td></td>
            <td class="col-monto">${fmtMoneda(a.gastosVenta)}</td>
            <td></td>
            <td></td>
          </tr>
          ${rowsGastosVentaDetalle}

          <tr>
            <td class="ps-3 fw-semibold">Gastos de Administración</td>
            <td></td>
            <td class="col-monto">${fmtMoneda(a.gastosAdmin)}</td>
            <td></td>
            <td></td>
          </tr>
          ${rowsGastosAdminDetalle}

          <tr>
            <td class="ps-3 fw-semibold">Gastos Financieros</td>
            <td></td>
            <td class="col-monto">${fmtMoneda(a.gastosFinancieros)}</td>
            <td></td>
            <td></td>
          </tr>
          ${rowsGastosFinancierosDetalle}

          <tr class="row-subtotal table-danger bg-opacity-10">
            <td class="ps-3 fw-bold text-danger">(=) TOTAL GASTOS DE OPERACIÓN</td>
            <td></td>
            <td></td>
            <td class="col-monto fw-bold text-danger">${fmtMoneda(a.totalGastosOperacion)}</td>
            <td class="col-monto fw-bold text-danger">${fmtMoneda(a.totalGastosOperacion)}</td>
          </tr>

          <!-- 5. RESULTADO FINAL: UTILIDAD DEL EJERCICIO -->
          <tr class="table-dark text-white fw-bold fs-5 double-underline">
            <td class="ps-3">(=) ${a.utilidadOperacion >= 0 ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO'}</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="col-monto ${badgeUtilidadOperacion} fw-bold fs-5">${fmtMoneda(a.utilidadOperacion)}</td>
          </tr>

        </tbody>
      </table>
    </div>

    <!-- Notas al Pie Contables -->
    <div class="row mt-4 pt-3 border-top text-muted small text-center">
      <div class="col-md-4">
        <div class="border-top border-dark mx-4 pt-2 fw-semibold">F. ____________________________</div>
        <div>Lic. Contador General</div>
      </div>
      <div class="col-md-4">
        <div class="border-top border-dark mx-4 pt-2 fw-semibold">F. ____________________________</div>
        <div>Representante Legal</div>
      </div>
      <div class="col-md-4">
        <div class="border-top border-dark mx-4 pt-2 fw-semibold">F. ____________________________</div>
        <div>Auditor Externo</div>
      </div>
    </div>
  `;
}

// Renderizado de la Vista Condensada
function renderizarCondensado(data) {
  const container = document.getElementById('erContainer');

  let ingresosRows = '';
  if (!data.ingresos || data.ingresos.length === 0) {
    ingresosRows = `<tr><td colspan="2" class="text-muted italic">No hay ingresos registrados</td></tr>`;
  } else {
    data.ingresos.forEach(i => {
      ingresosRows += `
        <tr>
          <td>${i.codigo} - ${i.nombre}</td>
          <td class="text-end fw-semibold">${fmtMoneda(i.saldo)}</td>
        </tr>
      `;
    });
  }

  let gastosRows = '';
  if (!data.costosGastos || data.costosGastos.length === 0) {
    gastosRows = `<tr><td colspan="2" class="text-muted italic">No hay costos o gastos registrados</td></tr>`;
  } else {
    data.costosGastos.forEach(g => {
      gastosRows += `
        <tr>
          <td>${g.codigo} - ${g.nombre}</td>
          <td class="text-end fw-semibold">${fmtMoneda(g.saldo)}</td>
        </tr>
      `;
    });
  }

  const utilidadClass = data.esUtilidad ? 'text-success' : 'text-danger';
  const utilidadText = data.esUtilidad ? 'UTILIDAD DEL EJERCICIO' : 'PÉRDIDA DEL EJERCICIO';

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table financial-table align-middle shadow-sm rounded-3 overflow-hidden">
        
        <!-- INGRESOS (Código 5) -->
        <thead>
          <tr class="table-light">
            <th colspan="2" class="fs-6 text-primary">
              <i class="bi bi-arrow-up-circle me-1"></i> INGRESOS OPERATIVOS (CÓDIGO 5)
            </th>
          </tr>
        </thead>
        <tbody>
          ${ingresosRows}
          <tr class="row-total text-primary">
            <td>TOTAL INGRESOS:</td>
            <td class="text-end fs-6">${fmtMoneda(data.totalIngresos)}</td>
          </tr>
        </tbody>

        <!-- COSTOS Y GASTOS (Código 4) -->
        <thead>
          <tr class="table-light">
            <th colspan="2" class="fs-6 text-danger">
              <i class="bi bi-arrow-down-circle me-1"></i> COSTOS Y GASTOS (CÓDIGO 4)
            </th>
          </tr>
        </thead>
        <tbody>
          ${gastosRows}
          <tr class="row-total text-danger">
            <td>TOTAL COSTOS Y GASTOS:</td>
            <td class="text-end fs-6">${fmtMoneda(data.totalCostosGastos)}</td>
          </tr>
        </tbody>

        <!-- UTILIDAD / PÉRDIDA -->
        <tfoot>
          <tr class="table-dark fs-5 fw-bold">
            <td>FÓRMULA: Código 5 (Ingresos) - Código 4 (Costos/Gastos) = ${utilidadText}:</td>
            <td class="text-end ${utilidadClass}">
              ${fmtMoneda(data.utilidadEjercicio)}
            </td>
          </tr>
        </tfoot>

      </table>
    </div>
  `;
}

// 2. Cargar y Renderizar Balance General
async function cargarBalanceGeneral() {
  const container = document.getElementById('bgContainer');
  try {
    const res = await fetch('/api/reportes/balance-general');
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="alert alert-danger">Error al cargar Balance General.</div>`;
      return;
    }

    // Filas Activo
    let activosRows = '';
    data.activos.forEach(a => {
      activosRows += `
        <tr>
          <td>${a.codigo} - ${a.nombre}</td>
          <td class="text-end">$${a.saldo.toFixed(2)}</td>
        </tr>
      `;
    });

    // Filas Pasivo
    let pasivosRows = '';
    data.pasivos.forEach(p => {
      pasivosRows += `
        <tr>
          <td>${p.codigo} - ${p.nombre}</td>
          <td class="text-end">$${p.saldo.toFixed(2)}</td>
        </tr>
      `;
    });

    // Filas Capital
    let capitalRows = '';
    data.capital.forEach(c => {
      capitalRows += `
        <tr>
          <td>${c.codigo} - ${c.nombre}</td>
          <td class="text-end">$${c.saldo.toFixed(2)}</td>
        </tr>
      `;
    });

    // Fila Utilidad
    const utilidadText = data.utilidadEjercicio >= 0 ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio';
    const utilidadFila = `
      <tr class="table-info fw-semibold">
        <td><i class="bi bi-calculator me-1"></i> ${utilidadText} (Estado de Resultados)</td>
        <td class="text-end">$${data.utilidadEjercicio.toFixed(2)}</td>
      </tr>
    `;

    const badgeCuadrado = data.estaCuadrado
      ? `<div class="alert alert-success text-center fw-bold fs-5 my-3">
           <i class="bi bi-patch-check-fill me-2"></i> ECUACIÓN CONTABLE CUADRADA: Activo ($${data.totalActivos.toFixed(2)}) = Pasivo + Patrimonio ($${data.totalPasivoCapital.toFixed(2)})
         </div>`
      : `<div class="alert alert-danger text-center fw-bold fs-5 my-3">
           <i class="bi bi-exclamation-octagon-fill me-2"></i> BALANCE DESCUADRADO: Activo ($${data.totalActivos.toFixed(2)}) ≠ Pasivo + Patrimonio ($${data.totalPasivoCapital.toFixed(2)})
         </div>`;

    container.innerHTML = `
      ${badgeCuadrado}
      <div class="row g-4">
        
        <!-- COLUMNA IZQUIERDA: ACTIVOS (Código 1) -->
        <div class="col-md-6">
          <div class="border rounded-3 p-3 bg-light h-100">
            <h5 class="fw-bold text-success border-bottom pb-2">
              <i class="bi bi-building me-1"></i> ACTIVOS (CÓDIGO 1)
            </h5>
            <table class="table table-sm align-middle">
              <tbody>
                ${activosRows.length > 0 ? activosRows : '<tr><td colspan="2" class="text-muted">Sin activos registrados</td></tr>'}
              </tbody>
              <tfoot>
                <tr class="row-total text-success fs-6">
                  <td>TOTAL ACTIVOS (1):</td>
                  <td class="text-end">$${data.totalActivos.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- COLUMNA DERECHA: PASIVOS (Código 2) Y CAPITAL (Código 3) -->
        <div class="col-md-6">
          <div class="border rounded-3 p-3 bg-light h-100">
            
            <h5 class="fw-bold text-primary border-bottom pb-2">
              <i class="bi bi-credit-card me-1"></i> PASIVOS (CÓDIGO 2)
            </h5>
            <table class="table table-sm align-middle mb-4">
              <tbody>
                ${pasivosRows.length > 0 ? pasivosRows : '<tr><td colspan="2" class="text-muted">Sin pasivos registrados</td></tr>'}
              </tbody>
              <tfoot>
                <tr class="row-total text-primary fs-6">
                  <td>TOTAL PASIVOS (2):</td>
                  <td class="text-end">$${data.totalPasivos.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <h5 class="fw-bold text-dark border-bottom pb-2">
              <i class="bi bi-piggy-bank me-1"></i> CAPITAL CONTABLE (CÓDIGO 3)
            </h5>
            <table class="table table-sm align-middle">
              <tbody>
                ${capitalRows}
                ${utilidadFila}
              </tbody>
              <tfoot>
                <tr class="row-total text-dark fs-6">
                  <td>TOTAL CAPITAL CONTABLE (3):</td>
                  <td class="text-end">$${(data.totalCapital + data.utilidadEjercicio).toFixed(2)}</td>
                </tr>
                <tr class="table-dark fs-6 fw-bold">
                  <td>TOTAL PASIVO + CAPITAL:</td>
                  <td class="text-end">$${data.totalPasivoCapital.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

          </div>
        </div>

      </div>
    `;

  } catch (err) {
    console.error('Error BG:', err);
    container.innerHTML = `<div class="alert alert-danger">Error de conexión al obtener Balance General.</div>`;
  }
}

// Limpiar estados financieros (Vaciar partidas)
async function limpiarEstados() {
  if (!confirm('¿Estás seguro de reiniciar los Estados Financieros?\n\nEsto eliminará todas las partidas registradas y dejará los saldos en $0.00.')) {
    return;
  }

  try {
    const res = await fetch('/api/partidas', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await cargarEstadoResultados();
      await cargarBalanceGeneral();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    console.error('Error al reiniciar estados:', err);
    alert('Error al reiniciar los estados financieros.');
  }
}

// --------------------------------------------------------
// EXPORTACIÓN A EXCEL Y PDF
// --------------------------------------------------------
function exportarExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería XLSX no está cargada. Intente recargar la página.');
    return;
  }

  try {
    const wb = XLSX.utils.book_new();

    // 1. Hoja de Estado de Resultados
    const erTable = document.querySelector('#pills-er table');
    if (erTable) {
      const wsER = XLSX.utils.table_to_sheet(erTable);
      XLSX.utils.book_append_sheet(wb, wsER, "Estado_Resultados");
    }

    // 2. Hoja de Balance General (Tablas Activo, Pasivo, Capital)
    const bgContainer = document.getElementById('balanceGeneralContainer');
    if (bgContainer) {
      const wsBG = XLSX.utils.table_to_sheet(bgContainer);
      XLSX.utils.book_append_sheet(wb, wsBG, "Balance_General");
    }

    const fechaStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Estados_Financieros_${fechaStr}.xlsx`);
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    alert('Ocurrió un error al generar el archivo de Excel.');
  }
}

function exportarPDF() {
  if (typeof html2pdf !== 'undefined') {
    const element = document.createElement('div');
    element.style.padding = '25px';
    element.style.background = '#ffffff';
    element.style.color = '#1b2420';
    element.style.fontFamily = 'Arial, sans-serif';

    const fechaActual = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    element.innerHTML = `
      <div style="text-align:center; margin-bottom: 25px; border-bottom: 2px solid #178F63; padding-bottom: 15px;">
        <h2 style="margin: 0; color: #0B231C; font-size: 22px; font-weight: bold;">SISTEMA CONTABLE & FINANCIERO</h2>
        <h4 style="margin: 5px 0 0 0; color: #178F63; font-size: 16px;">ESTADOS FINANCIEROS CONSOLIDADOS</h4>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6E7A70;">Emisión al ${fechaActual} | Expresado en $ USD</p>
      </div>
    `;

    const erDiv = document.getElementById('pills-er');
    const bgDiv = document.getElementById('pills-bg');

    if (erDiv) {
      const titleER = document.createElement('h4');
      titleER.style.color = '#0B231C';
      titleER.style.borderBottom = '1px solid #ddd';
      titleER.style.paddingBottom = '5px';
      titleER.style.marginTop = '20px';
      titleER.textContent = '1. Estado de Resultados';
      element.appendChild(titleER);

      const cloneER = erDiv.cloneNode(true);
      element.appendChild(cloneER);
    }

    if (bgDiv) {
      const titleBG = document.createElement('h4');
      titleBG.style.color = '#0B231C';
      titleBG.style.borderBottom = '1px solid #ddd';
      titleBG.style.paddingBottom = '5px';
      titleBG.style.marginTop = '30px';
      titleBG.textContent = '2. Balance General';
      element.appendChild(titleBG);

      const cloneBG = bgDiv.cloneNode(true);
      element.appendChild(cloneBG);
    }

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `Estados_Financieros_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  } else {
    window.print();
  }
}