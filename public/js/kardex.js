// Lógica del Módulo Kardex de Inventario (Almacén)
let movimientosKardex = [];
let resumenKardex = {};

document.addEventListener('DOMContentLoaded', async () => {
  const session = checkAuthRequirement();
  if (!session) return;

  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('movFecha').value = hoy;

  await cargarKardex();

  document.getElementById('formKardexMovimiento').addEventListener('submit', guardarMovimiento);
});

// Cargar y Renderizar datos del Kardex
async function cargarKardex() {
  try {
    const res = await fetch('/api/kardex');
    const data = await res.json();

    if (!data.success) {
      showAlert('Error al cargar datos del Kardex.', 'danger');
      return;
    }

    movimientosKardex = data.movimientos || [];
    resumenKardex = data.resumen || {};

    renderizarResumenKPIs();
    renderizarTablaKardex();

  } catch (err) {
    console.error('Error al cargar kardex:', err);
    showAlert('Error de conexión con el servidor al cargar Kardex.', 'danger');
  }
}

// Renderizar las 4 tarjetas KPI de resumen
function renderizarResumenKPIs() {
  let invInicialDinero = 0;
  let invInicialCant = 0;
  let comprasDinero = 0;
  let comprasCant = 0;

  movimientosKardex.forEach(m => {
    if (m.tipo_movimiento === 'INICIAL') {
      invInicialDinero += parseFloat(m.debe) || 0;
      invInicialCant += parseFloat(m.cant_entrada) || 0;
    } else if (m.tipo_movimiento === 'ENTRADA') {
      comprasDinero += parseFloat(m.debe) || 0;
      comprasCant += parseFloat(m.cant_entrada) || 0;
    }
  });

  document.getElementById('kpiInvInicialDinero').textContent = `$${invInicialDinero.toFixed(2)}`;
  document.getElementById('kpiInvInicialCant').textContent = `${invInicialCant.toLocaleString()} unidades`;

  document.getElementById('kpiComprasDinero').textContent = `$${comprasDinero.toFixed(2)}`;
  document.getElementById('kpiComprasCant').textContent = `${comprasCant.toLocaleString()} unidades compradas`;

  const salidasDinero = resumenKardex.totalHaber || 0;
  const salidasCant = resumenKardex.totalSalidasCant || 0;
  document.getElementById('kpiSalidasDinero').textContent = `$${salidasDinero.toFixed(2)}`;
  document.getElementById('kpiSalidasCant').textContent = `${salidasCant.toLocaleString()} unidades vendidas`;

  const invFinalDinero = resumenKardex.inventarioFinalDinero || 0;
  const invFinalCant = resumenKardex.inventarioFinalCant || 0;
  document.getElementById('kpiInvFinalDinero').textContent = `$${invFinalDinero.toFixed(2)}`;
  document.getElementById('kpiInvFinalCant').textContent = `${invFinalCant.toLocaleString()} unidades en bodega`;
}

// Renderizar la tabla de movimientos
function renderizarTablaKardex() {
  const tbody = document.getElementById('tbodyKardex');
  const tfoot = document.getElementById('tfootKardex');

  if (movimientosKardex.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
          No hay movimientos registrados en el Kardex.<br>
          Haz clic en <strong>"Registrar Movimiento"</strong> para ingresar el inventario inicial o compras.
        </td>
      </tr>
    `;
    tfoot.innerHTML = '';
    return;
  }

  let html = '';
  movimientosKardex.forEach(m => {
    let badgeClass = 'badge-mov-entrada';
    let badgeText = 'Entrada';

    if (m.tipo_movimiento === 'INICIAL') {
      badgeClass = 'badge-mov-inicial';
      badgeText = 'Inicial';
    } else if (m.tipo_movimiento === 'ENTRADA') {
      badgeClass = 'badge-mov-entrada';
      badgeText = 'Entrada / Compra';
    } else if (m.tipo_movimiento === 'SALIDA') {
      badgeClass = 'badge-mov-salida';
      badgeText = 'Salida / Venta';
    } else if (m.tipo_movimiento === 'DEV_COMPRA') {
      badgeClass = 'badge-mov-dev-compra';
      badgeText = 'Dev. s/ Compra';
    } else if (m.tipo_movimiento === 'DEV_VENTA') {
      badgeClass = 'badge-mov-dev-venta';
      badgeText = 'Dev. s/ Venta';
    }

    const cantEntrada = parseFloat(m.cant_entrada) > 0 ? parseFloat(m.cant_entrada).toLocaleString() : '-';
    const cantSalida = parseFloat(m.cant_salida) > 0 ? parseFloat(m.cant_salida).toLocaleString() : '-';
    const cantSaldo = parseFloat(m.cant_saldo).toLocaleString();

    const cu = parseFloat(m.costo_unitario) > 0 ? `$${parseFloat(m.costo_unitario).toFixed(4)}` : '-';
    const cp = parseFloat(m.costo_promedio) > 0 ? `$${parseFloat(m.costo_promedio).toFixed(4)}` : '-';

    const debe = parseFloat(m.debe) > 0 ? `$${parseFloat(m.debe).toFixed(2)}` : '-';
    const haber = parseFloat(m.haber) > 0 ? `$${parseFloat(m.haber).toFixed(2)}` : '-';
    const saldo = `$${parseFloat(m.saldo).toFixed(2)}`;

    html += `
      <tr>
        <td class="text-nowrap text-secondary">${m.fecha}</td>
        <td class="fw-semibold text-dark">${m.detalle}</td>
        <td class="text-center"><span class="badge ${badgeClass} px-2 py-1">${badgeText}</span></td>
        
        <!-- Cantidades -->
        <td class="text-end text-primary">${cantEntrada}</td>
        <td class="text-end text-danger">${cantSalida}</td>
        <td class="text-end fw-bold text-dark bg-primary-subtle">${cantSaldo}</td>

        <!-- Costos -->
        <td class="text-end text-muted">${cu}</td>
        <td class="text-end text-dark fw-semibold">${cp}</td>

        <!-- Valores Monetarios -->
        <td class="text-end text-success">${debe}</td>
        <td class="text-end text-danger">${haber}</td>
        <td class="text-end fw-bold text-dark bg-success-subtle">${saldo}</td>

        <!-- Acción -->
        <td class="text-center">
          <button class="btn btn-outline-danger btn-sm p-1" onclick="eliminarMovimiento(${m.id})" title="Eliminar fila">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Pie de tabla con totales
  tfoot.innerHTML = `
    <tr>
      <td colspan="3" class="text-end">TOTALES ACUMULADOS:</td>
      <td class="text-end text-info">${resumenKardex.totalEntradasCant.toLocaleString()}</td>
      <td class="text-end text-warning">${resumenKardex.totalSalidasCant.toLocaleString()}</td>
      <td class="text-end text-white">${resumenKardex.inventarioFinalCant.toLocaleString()} und.</td>
      <td colspan="2" class="text-center text-muted">C.P. Vigente: $${resumenKardex.costoPromedioActual.toFixed(4)}</td>
      <td class="text-end text-success">$${resumenKardex.totalDebe.toFixed(2)}</td>
      <td class="text-end text-warning">$${resumenKardex.totalHaber.toFixed(2)}</td>
      <td class="text-end text-white fs-6">$${resumenKardex.inventarioFinalDinero.toFixed(2)}</td>
      <td></td>
    </tr>
  `;
}

// Comportamiento del formulario según el tipo de movimiento
function onTipoMovChange() {
  const tipo = document.getElementById('movTipo').value;
  const help = document.getElementById('helpCostoUnitario');
  const cuInput = document.getElementById('movCostoUnitario');

  if (tipo === 'SALIDA') {
    help.textContent = 'En ventas (salidas): Debe ingresar obligatoriamente el precio unitario de la venta.';
    cuInput.placeholder = 'Obligatorio (Ej. 20.00)';
    cuInput.required = true;
  } else if (tipo === 'DEV_COMPRA') {
    help.textContent = 'En devoluciones s/ compra (salida a proveedor): Indica el costo unitario de compra devuelto o 0 para promedio.';
    cuInput.placeholder = 'Costo de compra devuelto';
    cuInput.required = false;
  } else if (tipo === 'DEV_VENTA') {
    help.textContent = 'En devoluciones s/ venta (reingreso de cliente): Indica el costo de salida original o 0 para promedio.';
    cuInput.placeholder = 'Costo de salida original';
    cuInput.required = false;
  } else {
    help.textContent = 'En entradas e inicial: Debe indicar el costo unitario de adquisición.';
    cuInput.placeholder = 'Ej. 12.50';
    cuInput.required = true;
  }
}

// Guardar nuevo movimiento
async function guardarMovimiento(e) {
  e.preventDefault();
  const alertBox = document.getElementById('modalAlert');
  const btn = document.getElementById('btnGuardarMov');

  const fecha = document.getElementById('movFecha').value;
  const tipo_movimiento = document.getElementById('movTipo').value;
  const detalle = document.getElementById('movDetalle').value;
  const cantidad = document.getElementById('movCantidad').value;
  const costo_unitario = document.getElementById('movCostoUnitario').value || 0;

  alertBox.innerHTML = '';

  const cuVal = parseFloat(costo_unitario) || 0;
  if ((tipo_movimiento === 'SALIDA' || tipo_movimiento === 'INICIAL' || tipo_movimiento === 'ENTRADA') && cuVal <= 0) {
    alertBox.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i> En movimientos de Venta o Compra es obligatorio ingresar un precio unitario mayor a $0.00.</div>`;
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Guardando...`;

  try {
    const res = await fetch('/api/kardex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, tipo_movimiento, detalle, cantidad, costo_unitario })
    });
    const data = await res.json();

    if (data.success) {
      const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoMovimiento'));
      if (modal) modal.hide();
      document.getElementById('formKardexMovimiento').reset();
      const hoy = new Date().toISOString().split('T')[0];
      document.getElementById('movFecha').value = hoy;

      showAlert(data.message, 'success');
      await cargarKardex();
    } else {
      alertBox.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    console.error('Error al guardar en kardex:', err);
    alertBox.innerHTML = `<div class="alert alert-danger">Error de comunicación con el servidor.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-save me-1"></i> Guardar en Kardex`;
  }
}

// Eliminar un movimiento individual
async function eliminarMovimiento(id) {
  if (!confirm('¿Deseas eliminar este movimiento? Los saldos posteriores se recalcularán automáticamente.')) {
    return;
  }

  try {
    const res = await fetch(`/api/kardex/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message, 'info');
      await cargarKardex();
    } else {
      showAlert(data.message, 'danger');
    }
  } catch (err) {
    console.error('Error al eliminar:', err);
    showAlert('Error al eliminar movimiento.', 'danger');
  }
}

// Vaciar Kardex
async function confirmarVaciarKardex() {
  if (!confirm('¿Estás seguro de vaciar todos los registros del Kardex para iniciar un ejercicio desde cero?')) {
    return;
  }

  try {
    const res = await fetch('/api/kardex', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showAlert('Kardex reiniciado con éxito.', 'warning');
      await cargarKardex();
    }
  } catch (err) {
    console.error('Error al vaciar kardex:', err);
    showAlert('Error al reiniciar Kardex.', 'danger');
  }
}

// Transferir el Inventario Final determinado en Kardex al Asistente de Ajuste de Diario
function aplicarAlLibroDiario() {
  const invFinal = resumenKardex.inventarioFinalDinero || 0;
  if (invFinal <= 0 && movimientosKardex.length === 0) {
    showAlert('El Kardex no tiene movimientos registrados para transferir un Inventario Final.', 'warning');
    return;
  }

  localStorage.setItem('inv_final_kardex', invFinal.toFixed(2));
  window.location.href = 'diario.html?abrirAjuste=true';
}
