// Lógica del Libro Diario y Validación en Tiempo Real de Partida Doble

let catalogoCuentas = [];
let contadorFilas = 0;
let listaPartidasCargadas = [];

document.addEventListener('DOMContentLoaded', async () => {
  const session = checkAuthRequirement();
  if (!session) return;

  // Establecer fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('fechaInput').value = hoy;
  const fechaAjuste = document.getElementById('fechaAjusteInput');
  if (fechaAjuste) fechaAjuste.value = hoy;

  // Cargar catálogo de cuentas y correlativo
  await cargarCatalogo();
  await cargarSiguienteNumero();
  await cargarHistorialPartidas();

  // Inicializar con 2 filas por defecto
  agregarFila();
  agregarFila();

  // Listener para agregar filas
  document.getElementById('btnAgregarFila').addEventListener('click', () => {
    agregarFila();
  });

  // Listener del formulario
  document.getElementById('partidaForm').addEventListener('submit', guardarPartida);

  // Listener del Asistente de Ajuste de Inventarios
  const formAjuste = document.getElementById('formAjusteInventarios');
  if (formAjuste) {
    formAjuste.addEventListener('submit', ejecutarAjusteInventarios);
  }

  // Verificar si viene transferido el Inventario Final desde el Kardex
  const urlParams = new URLSearchParams(window.location.search);
  const abrirAjuste = urlParams.get('abrirAjuste');
  const invFinalKardex = localStorage.getItem('inv_final_kardex');

  if (abrirAjuste === 'true' && invFinalKardex) {
    const invInput = document.getElementById('invFinalInput');
    if (invInput) invInput.value = invFinalKardex;
    localStorage.removeItem('inv_final_kardex');

    const modalEl = document.getElementById('modalAjusteInventarios');
    if (modalEl) {
      setTimeout(() => {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }, 400);
    }
  }
});

// Cargar Catálogo de Cuentas desde la API
async function cargarCatalogo() {
  try {
    const res = await fetch('/api/catalogo');
    const data = await res.json();
    if (data.success) {
      catalogoCuentas = data.cuentas;
    }
  } catch (err) {
    console.error('Error al cargar catálogo:', err);
    showAlert('Error al cargar el catálogo de cuentas contables.', 'danger');
  }
}

// Cargar el número de la siguiente partida
async function cargarSiguienteNumero() {
  try {
    const res = await fetch('/api/partidas/siguiente-numero');
    const data = await res.json();
    if (data.success) {
      document.getElementById('numeroPartidaInput').value = data.siguienteNumero;
      document.getElementById('badgeNumeroPartida').textContent = `Partida N° ${data.siguienteNumero}`;
    }
  } catch (err) {
    console.error('Error al obtener correlativo:', err);
  }
}

// Agregar fila dinámica a la tabla con Parcial, Debe y Haber
function agregarFila() {
  contadorFilas++;
  const tbody = document.getElementById('filasDetalles');
  const tr = document.createElement('tr');
  tr.id = `fila_${contadorFilas}`;

  // Opciones de cuentas contables
  let optionsHtml = `<option value="">-- Seleccionar Cuenta Contable --</option>`;
  catalogoCuentas.forEach(cuenta => {
    optionsHtml += `<option value="${cuenta.id}">${cuenta.codigo} - ${cuenta.nombre} (${cuenta.naturaleza})</option>`;
  });

  tr.innerHTML = `
    <td>
      <select class="form-select cuenta-select" required>
        ${optionsHtml}
      </select>
    </td>
    <td>
      <input type="number" step="0.01" min="0" class="form-control text-end parcial-input" placeholder="0.00" value="0.00" onfocus="if(this.value=='0.00')this.value=''" onblur="if(this.value=='')this.value='0.00'">
    </td>
    <td>
      <input type="number" step="0.01" min="0" class="form-control text-end debe-input" placeholder="0.00" value="0.00" onfocus="if(this.value=='0.00')this.value=''" onblur="if(this.value=='')this.value='0.00'" oninput="onMontoInput(this); calcularTotales();">
    </td>
    <td>
      <input type="number" step="0.01" min="0" class="form-control text-end haber-input" placeholder="0.00" value="0.00" onfocus="if(this.value=='0.00')this.value=''" onblur="if(this.value=='')this.value='0.00'" oninput="onMontoInput(this); calcularTotales();">
    </td>
    <td class="text-center">
      <button type="button" class="btn btn-outline-danger btn-sm" onclick="eliminarFila(${contadorFilas})" title="Eliminar fila">
        <i class="bi bi-trash"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  calcularTotales();
}

// Si ingresa valor en Debe, se limpia Haber y viceversa para facilitar el llenado
function onMontoInput(inputEl) {
  const row = inputEl.closest('tr');
  const debeEl = row.querySelector('.debe-input');
  const haberEl = row.querySelector('.haber-input');

  if (inputEl.classList.contains('debe-input') && parseFloat(inputEl.value) > 0) {
    haberEl.value = '0.00';
  } else if (inputEl.classList.contains('haber-input') && parseFloat(inputEl.value) > 0) {
    debeEl.value = '0.00';
  }
}

// Eliminar fila dinámica
function eliminarFila(idFila) {
  const tbody = document.getElementById('filasDetalles');
  if (tbody.children.length <= 2) {
    showAlert('Una partida debe contener obligatoriamente al menos dos cuentas.', 'warning');
    return;
  }
  const fila = document.getElementById(`fila_${idFila}`);
  if (fila) {
    fila.remove();
    calcularTotales();
  }
}

// Calcular sumatoria Debe vs Haber y validar Partida Doble
function calcularTotales() {
  let totalDebe = 0;
  let totalHaber = 0;

  const filas = document.querySelectorAll('#filasDetalles tr');
  filas.forEach(fila => {
    const debeVal = parseFloat(fila.querySelector('.debe-input').value) || 0;
    const haberVal = parseFloat(fila.querySelector('.haber-input').value) || 0;
    totalDebe += debeVal;
    totalHaber += haberVal;
  });

  totalDebe = Math.round(totalDebe * 100) / 100;
  totalHaber = Math.round(totalHaber * 100) / 100;

  document.getElementById('totalDebeCell').textContent = `$${totalDebe.toFixed(2)}`;
  document.getElementById('totalHaberCell').textContent = `$${totalHaber.toFixed(2)}`;

  const indicador = document.getElementById('indicadorBalance');
  const btnGuardar = document.getElementById('btnGuardarPartida');

  const esCuadrado = totalDebe > 0 && totalDebe === totalHaber;
  const dif = Math.abs(totalDebe - totalHaber).toFixed(2);

  if (esCuadrado) {
    indicador.className = 'balance-badge balanced alert alert-success mb-0 py-2 px-3 fw-bold';
    indicador.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Partida Cuadrada (Debe = Haber = $${totalDebe.toFixed(2)})`;
    btnGuardar.disabled = false;
  } else {
    indicador.className = 'balance-badge unbalanced alert alert-danger mb-0 py-2 px-3 fw-bold';
    if (totalDebe === 0 && totalHaber === 0) {
      indicador.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Ingrese montos en las cuentas`;
    } else {
      indicador.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1"></i> Descuadrada (Diferencia: $${dif})`;
    }
    btnGuardar.disabled = true;
  }
}

// Guardar partida en Backend enviando Parcial, Debe y Haber
async function guardarPartida(e) {
  e.preventDefault();
  showAlert('', 'clear');

  const numero_partida = parseInt(document.getElementById('numeroPartidaInput').value, 10);
  const fecha = document.getElementById('fechaInput').value;
  const concepto = document.getElementById('conceptoInput').value;

  const detalles = [];
  const filas = document.querySelectorAll('#filasDetalles tr');
  
  for (let fila of filas) {
    const cuentaId = fila.querySelector('.cuenta-select').value;
    const parcialVal = parseFloat(fila.querySelector('.parcial-input').value) || 0;
    const debeVal = parseFloat(fila.querySelector('.debe-input').value) || 0;
    const haberVal = parseFloat(fila.querySelector('.haber-input').value) || 0;

    if (!cuentaId) {
      showAlert('Todas las líneas deben tener una cuenta contable seleccionada.', 'warning');
      return;
    }

    detalles.push({
      cuenta_id: cuentaId,
      parcial: parcialVal,
      debe: debeVal,
      haber: haberVal
    });
  }

  try {
    const res = await fetch('/api/partidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_partida, fecha, concepto, detalles })
    });

    const data = await res.json();

    if (data.success) {
      showAlert(data.message, 'success');
      // Resetear formulario
      document.getElementById('conceptoInput').value = '';
      document.getElementById('filasDetalles').innerHTML = '';
      agregarFila();
      agregarFila();
      await cargarSiguienteNumero();
      await cargarHistorialPartidas();
    } else {
      showAlert(data.message, 'danger');
    }
  } catch (err) {
    console.error('Error al guardar partida:', err);
    showAlert('Error de conexión con el servidor al intentar guardar.', 'danger');
  }
}

// Cargar historial de partidas del Libro Diario incluyendo la columna Parcial
async function cargarHistorialPartidas() {
  const container = document.getElementById('historialPartidasContainer');
  try {
    const res = await fetch('/api/partidas');
    const data = await res.json();

    if (!data.success || !data.partidas || data.partidas.length === 0) {
      listaPartidasCargadas = [];
      container.innerHTML = `
        <div class="alert alert-info text-center mb-0">
          <i class="bi bi-info-circle me-1"></i> No hay partidas registradas en el Libro Diario aún.
        </div>
      `;
      return;
    }

    listaPartidasCargadas = data.partidas;
    let html = '';
    
    data.partidas.forEach(p => {
      let filasHtml = '';
      let sumDebe = 0;
      let sumHaber = 0;

      p.detalles.forEach(d => {
        const dParcial = parseFloat(d.parcial || 0);
        const dDebe = parseFloat(d.debe || 0);
        const dHaber = parseFloat(d.haber || 0);
        sumDebe += dDebe;
        sumHaber += dHaber;

        filasHtml += `
          <tr>
            <td>${d.codigo} - ${d.cuenta_nombre || d.nombre}</td>
            <td class="text-end">${dParcial > 0 ? '$' + dParcial.toFixed(2) : ''}</td>
            <td class="text-end">${dDebe > 0 ? '$' + dDebe.toFixed(2) : ''}</td>
            <td class="text-end">${dHaber > 0 ? '$' + dHaber.toFixed(2) : ''}</td>
          </tr>
        `;
      });

      html += `
        <div class="border rounded-3 p-3 mb-4 bg-white shadow-sm">
          <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom flex-wrap gap-2">
            <div>
              <span class="badge bg-dark fs-6 me-2">Partida N° ${p.numero_partida}</span>
              <span class="text-muted fw-semibold"><i class="bi bi-calendar3 me-1"></i>${p.fecha}</span>
            </div>
            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="eliminarPartida(${p.id}, ${p.numero_partida})" title="Eliminar Partida N° ${p.numero_partida}">
              <i class="bi bi-trash me-1"></i> Eliminar
            </button>
          </div>
          <p class="mb-3"><strong>Concepto:</strong> ${p.concepto}</p>
          <div class="table-responsive">
            <table class="table table-sm table-bordered mb-0">
              <thead class="table-light">
                <tr>
                  <th>Cuenta Contable</th>
                  <th class="text-end" style="width: 20%;">Parcial</th>
                  <th class="text-end" style="width: 20%;">Debe</th>
                  <th class="text-end" style="width: 20%;">Haber</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
              <tfoot class="fw-bold table-light">
                <tr>
                  <td class="text-end">TOTAL:</td>
                  <td></td>
                  <td class="text-end text-success">$${sumDebe.toFixed(2)}</td>
                  <td class="text-end text-primary">$${sumHaber.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (err) {
    console.error('Error al cargar historial:', err);
    container.innerHTML = `<div class="alert alert-danger">Error al cargar el Libro Diario.</div>`;
  }
}

// Ejecutar Asistente de Ajuste de Inventarios
async function ejecutarAjusteInventarios(e) {
  e.preventDefault();
  const alertBox = document.getElementById('modalAjusteAlert');
  const btn = document.getElementById('btnEjecutarAjuste');
  const fecha = document.getElementById('fechaAjusteInput').value;
  const inventario_final = document.getElementById('invFinalInput').value;

  alertBox.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Procesando ajustes...`;

  try {
    const res = await fetch('/api/partidas/ajuste-inventarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, inventario_final })
    });
    const data = await res.json();

    if (data.success) {
      alertBox.innerHTML = `
        <div class="alert alert-success">
          <strong>¡Ajustes Registrados con Éxito!</strong><br>
          ${data.message}<br>
          <small class="d-block mt-2">
            • Mercancía Disponible: <strong>$${data.mercanciaDisponible.toFixed(2)}</strong><br>
            • Costo de Ventas Determinado: <strong>$${data.costoVentas.toFixed(2)}</strong>
          </small>
        </div>
      `;
      // Recargar correlativo y lista de partidas
      await cargarSiguienteNumero();
      await cargarHistorialPartidas();

      setTimeout(() => {
        const modalEl = document.getElementById('modalAjusteInventarios');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        document.getElementById('formAjusteInventarios').reset();
        alertBox.innerHTML = '';
        showAlert(data.message, 'success');
      }, 1800);
    } else {
      alertBox.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    console.error('Error al procesar ajuste:', err);
    alertBox.innerHTML = `<div class="alert alert-danger">Error de comunicación con el servidor.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Generar Asientos de Ajuste`;
  }
}

// Eliminar una partida individual
async function eliminarPartida(id, numeroPartida) {
  if (!confirm(`¿Estás seguro de eliminar la Partida N° ${numeroPartida}? Se revertirán sus cargos y abonos en el Libro Mayor.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/partidas/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message, 'info');
      await cargarSiguienteNumero();
      await cargarHistorialPartidas();
    } else {
      showAlert(data.message, 'danger');
    }
  } catch (err) {
    console.error('Error al eliminar partida:', err);
    showAlert('Error de comunicación con el servidor al eliminar partida.', 'danger');
  }
}

// Vaciar todas las partidas del Libro Diario
async function vaciarLibroDiario() {
  if (!confirm('⚠️ ¿Estás seguro de VACIAR TODO el Libro Diario?\n\nSe eliminarán todas las partidas registradas y el correlativo volverá a 1. Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const res = await fetch('/api/partidas', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message, 'warning');
      await cargarSiguienteNumero();
      await cargarHistorialPartidas();
    } else {
      showAlert(data.message, 'danger');
    }
  } catch (err) {
    console.error('Error al vaciar libro diario:', err);
    showAlert('Error al vaciar Libro Diario.', 'danger');
  }
}

// Restablecer ejercicio demo completo
async function restablecerDemo() {
  if (!confirm('¿Deseas recargar el ejercicio completo predeterminado (7 partidas + inventario y kardex)?')) {
    return;
  }

  try {
    const res = await fetch('/api/partidas/restablecer-demo', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showAlert(data.message, 'success');
      await cargarSiguienteNumero();
      await cargarHistorialPartidas();
    } else {
      showAlert(data.message, 'danger');
    }
  } catch (err) {
    console.error('Error al restablecer demo:', err);
    showAlert('Error al restablecer ejercicio demo.', 'danger');
  }
}