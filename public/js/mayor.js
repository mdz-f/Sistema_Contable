// Lógica de Mayorización Automática en Tiempo Real - Libro Mayor

let datosMayor = [];
let vistaActual = 'T'; // 'T' o 'Tabla'

document.addEventListener('DOMContentLoaded', async () => {
    const session = checkAuthRequirement();
    if (!session) return;

    await cargarLibroMayor();

    // Listeners de búsqueda y filtrado
    document.getElementById('busquedaInput').addEventListener('input', renderizarMayor);
    document.getElementById('filtroTipoSelect').addEventListener('change', renderizarMayor);

    // Toggle de vistas
    const btnT = document.getElementById('btnVistaCuentasT');
    const btnTabla = document.getElementById('btnVistaTabla');

    btnT.addEventListener('click', () => {
        vistaActual = 'T';
        btnT.className = 'btn btn-primary active';
        btnTabla.className = 'btn btn-outline-primary';
        renderizarMayor();
    });

    btnTabla.addEventListener('click', () => {
        vistaActual = 'Tabla';
        btnTabla.className = 'btn btn-primary active';
        btnT.className = 'btn btn-outline-primary';
        renderizarMayor();
    });
});

// Cargar datos de mayorización desde el servidor
async function cargarLibroMayor() {
    try {
        const res = await fetch('/api/reportes/mayor');
        const data = await res.json();
        if (data.success) {
            datosMayor = data.libroMayor || [];
            renderizarMayor();
        } else {
            showError('Error al obtener datos del Libro Mayor.');
        }
    } catch (err) {
        console.error('Error al cargar mayor:', err);
        showError('Error de conexión al cargar Libro Mayor.');
    }
}

// Renderizar según filtros y modo de vista
function renderizarMayor() {
    const container = document.getElementById('mayorContent');
    const busqueda = document.getElementById('busquedaInput').value.toLowerCase().trim();
    const filtroTipo = document.getElementById('filtroTipoSelect').value;

    // Filtrar cuentas según texto y tipo
    const cuentasFiltradas = datosMayor.filter(c => {
        const coincideTexto = c.codigo.toLowerCase().includes(busqueda) || c.nombre.toLowerCase().includes(busqueda);
        const coincideTipo = filtroTipo === 'todos' || c.tipo.toString() === filtroTipo;
        return coincideTexto && coincideTipo;
    });

    // Calcular y actualizar los totales de saldos deudor y acreedor abajo de la interfaz
    actualizarTotalesSaldosGlobales(cuentasFiltradas);

    if (cuentasFiltradas.length === 0) {
        container.innerHTML = `<div class="alert alert-warning text-center py-4"> <i class="bi bi-search me-2 fs-4"></i> No se encontraron cuentas contables que coincidan con los filtros seleccionados. </div>`;
        return;
    }

    if (vistaActual === 'T') {
        renderizarCuentasT(cuentasFiltradas, container);
    } else {
        renderizarTablaResumen(cuentasFiltradas, container);
    }
}

// Función para calcular las sumas globales de saldos deudores y acreedores
function actualizarTotalesSaldosGlobales(cuentas) {
    let totalDeudorGlobal = 0;
    let totalAcreedorGlobal = 0;

    cuentas.forEach(c => {
        const totalDebeCta = parseFloat(c.total_debe || 0);
        const totalHaberCta = parseFloat(c.total_haber || 0);
        const saldoVal = parseFloat(c.saldo || 0);

        let esDeudora;
        if (totalDebeCta > totalHaberCta) {
            esDeudora = true;
        } else if (totalHaberCta > totalDebeCta) {
            esDeudora = false;
        } else {
            esDeudora = c.naturaleza === 'DEUDORA';
        }

        if (esDeudora) {
            totalDeudorGlobal += saldoVal;
        } else {
            totalAcreedorGlobal += saldoVal;
        }
    });

    // Buscar los elementos en el DOM encargados de mostrar estos totales (ajusta los IDs si en tu HTML son distintos)
    const elDeudor = document.getElementById('totalSaldoDeudor') || document.querySelector('.total-saldo-deudor');
    const elAcreedor = document.getElementById('totalSaldoAcreedor') || document.querySelector('.total-saldo-acreedor');

    // Si usas clases o estructuras específicas en el HTML de los totales, los actualizamos de forma segura por contenido de texto o selectores comunes
    // O bien asignamos directamente si existen los elementos de tarjeta de totales:
    document.querySelectorAll('*').forEach(el => {
        if (el.textContent.trim() === 'Total Saldo Deudor' || el.previousElementSibling?.textContent?.includes('Total Saldo Deudor')) {
            const valContainer = el.parentElement.querySelector('span, div.fs-5, div.fw-bold') || el.nextElementSibling;
            if (valContainer) valContainer.textContent = '$' + totalDeudorGlobal.toFixed(2);
        }
        if (el.textContent.trim() === 'Total Saldo Acreedor' || el.previousElementSibling?.textContent?.includes('Total Saldo Acreedor')) {
            const valContainer = el.parentElement.querySelector('span, div.fs-5, div.fw-bold') || el.nextElementSibling;
            if (valContainer) valContainer.textContent = '$' + totalAcreedorGlobal.toFixed(2);
        }
    });

    // Por si tienes IDs directos estándar recomendados:
    if (elDeudor) elDeudor.textContent = '$' + totalDeudorGlobal.toFixed(2);
    if (elAcreedor) elAcreedor.textContent = '$' + totalAcreedorGlobal.toFixed(2);
}

// Renderizar Vista de Cuentas en T (Formato Tradicional Contable de 4 Columnas Exacto al Excel)
function renderizarCuentasT(cuentas, container) {
    let html = '<div class="row g-4">';

    cuentas.forEach(c => {
        const natClass = c.naturaleza === 'DEUDORA' ? 'bg-success' : 'bg-primary';
        
        const totalDebeCta = parseFloat(c.total_debe || 0);
        const totalHaberCta = parseFloat(c.total_haber || 0);
        let esDeudora;
        if (totalDebeCta > totalHaberCta) {
            esDeudora = true;
        } else if (totalHaberCta > totalDebeCta) {
            esDeudora = false;
        } else {
            esDeudora = c.naturaleza === 'DEUDORA';
        }

        const movs = c.movimientos || [];
        const movsDebe = movs.filter(m => parseFloat(m.debe || 0) > 0);
        const movsHaber = movs.filter(m => parseFloat(m.haber || 0) > 0);
        const filasMinimas = Math.max(movsDebe.length, movsHaber.length, 1);

        let movimientosRows = '';

        if (movsDebe.length === 0 && movsHaber.length === 0) {
            movimientosRows = `
                <tr>
                    <td colspan="4" class="text-center text-muted fst-italic py-2">Sin movimientos</td>
                </tr>
            `;
        } else {
            for (let i = 0; i < filasMinimas; i++) {
                const md = movsDebe[i];
                const mh = movsHaber[i];
                let refDebe = '', montoDebe = '', refHaber = '', montoHaber = '';

                if (md) {
                    const dVal = parseFloat(md.debe || 0);
                    const pNum = md.numero_partida || md.partida || '';
                    refDebe = pNum ? `A${pNum}` : '';
                    montoDebe = dVal > 0 ? '$' + dVal.toFixed(2) : '';
                }
                if (mh) {
                    const hVal = parseFloat(mh.haber || 0);
                    const pNum = mh.numero_partida || mh.partida || '';
                    refHaber = pNum ? `A${pNum}` : '';
                    montoHaber = hVal > 0 ? '$' + hVal.toFixed(2) : '';
                }

                movimientosRows += `
                    <tr>
                        <td class="text-center fw-bold text-muted bg-light" style="width: 15%;">${refDebe}</td>
                        <td class="text-end fw-semibold" style="width: 35%;">${montoDebe}</td>
                        <td class="text-end fw-semibold" style="width: 35%;">${montoHaber}</td>
                        <td class="text-center fw-bold text-muted bg-light" style="width: 15%;">${refHaber}</td>
                    </tr>
                `;
            }
        }

        const totalDebe = parseFloat(c.total_debe || 0);
        const totalHaber = parseFloat(c.total_haber || 0);
        const saldoVal = parseFloat(c.saldo || 0);
        const strSaldo = '$' + saldoVal.toFixed(2);

        let saldoHtml = '';
        if (esDeudora) {
            saldoHtml = `
                <div class="d-flex justify-content-between align-items-center pt-2 border-top px-2 py-1 rounded" style="background-color: #FCE4D6 !important;">
                    <span class="fw-bold text-dark">Saldo deudor:</span>
                    <span class="fs-6 fw-bold text-dark">${strSaldo}</span>
                </div>
            `;
        } else {
            saldoHtml = `
                <div class="d-flex justify-content-between align-items-center pt-2 border-top px-2 py-1 rounded" style="background-color: #E2EFDA !important;">
                    <span class="fw-bold text-dark">Saldo acreedor:</span>
                    <span class="fs-6 fw-bold text-dark">${strSaldo}</span>
                </div>
            `;
        }

        html += `
            <div class="col-md-6 col-lg-6">
                <div class="t-account-card shadow-sm border rounded overflow-hidden">
                    <div class="t-account-header bg-dark text-white text-center py-2 fw-bold">
                        ${c.codigo} - ${c.nombre}
                    </div>
                    
                    <div class="table-responsive m-0">
                        <table class="table table-bordered t-account-table mb-0">
                            <thead>
                                <tr class="table-light">
                                    <th colspan="2" class="text-dark text-center border-end">DEBE</th>
                                    <th colspan="2" class="text-dark text-center">HABER</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${movimientosRows}
                            </tbody>
                        </table>
                    </div>

                    <div class="t-account-footer p-2 bg-white border-top">
                        <div class="d-flex justify-content-between align-items-center mb-1 border-bottom pb-1">
                            <span class="text-muted small">Totales:</span>
                            <span>
                                <span class="text-dark fw-bold me-3">D: $${totalDebe.toFixed(2)}</span>
                                <span class="text-dark fw-bold">H: $${totalHaber.toFixed(2)}</span>
                            </span>
                        </div>
                        ${saldoHtml}
                    </div>
                    <div class="${natClass} text-white text-center py-1 small fw-bold">
                        Naturaleza ${c.naturaleza}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Renderizar Vista de Tabla Resumen Consolidada
function renderizarTablaResumen(cuentas, container) {
    let filasHtml = '';
    let sumDebe = 0;
    let sumHaber = 0;

    cuentas.forEach(c => {
        const tDebe = parseFloat(c.total_debe || 0);
        const tHaber = parseFloat(c.total_haber || 0);
        const sVal = parseFloat(c.saldo || 0);

        sumDebe += tDebe;
        sumHaber += tHaber;

        filasHtml += `
            <tr>
                <td class="fw-bold">${c.codigo}</td>
                <td>${c.nombre}</td>
                <td><span class="badge bg-secondary">Tipo ${c.tipo}</span></td>
                <td>
                    <span class="badge ${c.naturaleza === 'DEUDORA' ? 'bg-success' : 'bg-primary'}">
                        ${c.naturaleza}
                    </span>
                </td>
                <td class="text-end text-success fw-semibold">$${tDebe.toFixed(2)}</td>
                <td class="text-end text-primary fw-semibold">$${tHaber.toFixed(2)}</td>
                <td class="text-end fw-bold">$${sVal.toFixed(2)}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="card custom-card">
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped table-hover align-middle mb-0">
                        <thead class="table-dark">
                            <tr>
                                <th>Código</th>
                                <th>Nombre de la Cuenta</th>
                                <th>Tipo</th>
                                <th>Naturaleza</th>
                                <th class="text-end">Total Debe</th>
                                <th class="text-end">Total Haber</th>
                                <th class="text-end">Saldo Neto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHtml}
                        </tbody>
                        <tfoot class="table-group-divider fw-bold bg-light fs-6">
                            <tr>
                                <td colspan="4" class="text-end">TOTALES GENERALES:</td>
                                <td class="text-end text-success">$${sumDebe.toFixed(2)}</td>
                                <td class="text-end text-primary">$${sumHaber.toFixed(2)}</td>
                                <td class="text-end">$${(sumDebe - sumHaber).toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Función para Imprimir
function imprimirMayor() {
    if (!datosMayor || datosMayor.length === 0) {
        alert('No hay datos en el Libro Mayor para imprimir.');
        return;
    }

    let bloquesHTML = '';

    datosMayor.forEach(c => {
        let filasMovs = '';
        let totalD = parseFloat(c.total_debe || 0);
        let totalH = parseFloat(c.total_haber || 0);

        if (Array.isArray(c.movimientos) && c.movimientos.length > 0) {
            c.movimientos.forEach(m => {
                const d = parseFloat(m.debe || 0);
                const h = parseFloat(m.haber || 0);
                filasMovs += `
                    <tr>
                        <td class="txt-center">${m.fecha || ''}</td>
                        <td class="txt-center">P#${m.numero_partida || m.partida || ''}</td>
                        <td class="txt-left">${m.concepto || ''}</td>
                        <td class="txt-right">${d > 0 ? '$' + d.toFixed(2) : ''}</td>
                        <td class="txt-right">${h > 0 ? '$' + h.toFixed(2) : ''}</td>
                    </tr>
                `;
            });
        } else {
            filasMovs = '<tr><td colspan="5" class="txt-center">Sin movimientos</td></tr>';
        }

        const saldoVal = parseFloat(c.saldo || 0);

        bloquesHTML += `
            <div class="cuenta-block">
                <table class="tabla-mayor">
                    <thead>
                        <tr class="header-main">
                            <th colspan="5">${c.codigo} - ${c.nombre} (Naturaleza ${c.naturaleza})</th>
                        </tr>
                        <tr class="header-sub">
                            <th style="width: 12%;">Fecha</th>
                            <th style="width: 10%;">Partida</th>
                            <th style="width: 50%;">Concepto</th>
                            <th style="width: 14%;">Debe (Débitos)</th>
                            <th style="width: 14%;">Haber (Créditos)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasMovs}
                        <tr class="row-totales">
                            <td colspan="3" class="txt-right font-bold">Suma Débitos / Créditos:</td>
                            <td class="txt-right font-bold">$${totalD.toFixed(2)}</td>
                            <td class="txt-right font-bold">$${totalH.toFixed(2)}</td>
                        </tr>
                        <tr class="row-saldo">
                            <td colspan="3" class="txt-right font-bold">SALDO SEGÚN NATURALEZA (${c.naturaleza}):</td>
                            <td colspan="2" class="txt-center font-bold">$${saldoVal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });

    const printWin = window.open('', '_blank', 'width=1000,height=700');
    if (!printWin) {
        alert('Permite los pop-ups para imprimir el reporte.');
        return;
    }

    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Libro Mayor - Impresión</title>
            <style>
                @page { size: letter landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 0; }
                .report-header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px; }
                .report-header h2 { margin: 0; font-size: 16pt; text-transform: uppercase; }
                .cuenta-block { margin-bottom: 15px; page-break-inside: avoid; }
                .tabla-mayor { width: 100%; border-collapse: collapse; }
                .tabla-mayor th, .tabla-mayor td { border: 1px solid #000; padding: 5px 7px; font-size: 9pt; }
                .header-main { background-color: #212529; color: #fff; text-align: center; font-weight: bold; }
                .header-sub th { background-color: #e9ecef; color: #000; text-align: center; font-weight: bold; }
                .row-totales td { background-color: #f8f9fa; border-top: 2px solid #000; }
                .row-saldo td { background-color: #e9ecef; font-size: 9.5pt; }
                .txt-center { text-align: center; }
                .txt-left { text-align: left; }
                .txt-right { text-align: right; }
                .font-bold { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h2>Libro Mayor Contable</h2>
                <p>Fecha de emisión: ${new Date().toLocaleDateString('es-SV')}</p>
            </div>
            ${bloquesHTML}
        </body>
        </html>
    `);

    printWin.document.close();
    printWin.focus();

    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 300);
}

// Función para Exportar PDF
function exportarPDF() {
    if (!datosMayor || datosMayor.length === 0) {
        alert('No hay datos en el Libro Mayor para exportar.');
        return;
    }

    const cuentasConDatos = datosMayor.filter(c => {
        const tieneMovs = Array.isArray(c.movimientos) && c.movimientos.length > 0;
        const tieneTotales = parseFloat(c.total_debe || 0) !== 0 ||
                             parseFloat(c.total_haber || 0) !== 0 ||
                             parseFloat(c.saldo || 0) !== 0;
        return tieneMovs || tieneTotales;
    });

    if (cuentasConDatos.length === 0) {
        alert('No hay cuentas con movimientos o saldos para generar el PDF.');
        return;
    }

    const contenedor = document.createElement('div');
    contenedor.style.width = '700px';
    contenedor.style.padding = '20px';
    contenedor.style.backgroundColor = '#ffffff';
    contenedor.style.fontFamily = 'Arial, sans-serif';

    let html = `<h2 style="text-align: center; font-size: 16px; margin-bottom: 20px; font-weight: bold; color: #212529;">Libro Mayor - Cuentas T</h2> <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: space-between;">`;

    cuentasConDatos.forEach(c => {
        const totalDebe = parseFloat(c.total_debe || 0);
        const totalHaber = parseFloat(c.total_haber || 0);
        const saldo = parseFloat(c.saldo || 0);

        let esDeudora;
        if (totalDebe > totalHaber) {
            esDeudora = true;
        } else if (totalHaber > totalDebe) {
            esDeudora = false;
        } else {
            esDeudora = c.naturaleza === 'DEUDORA';
        }

        html += `
            <div style="width: 48%; border: 1.5px solid #212529; margin-bottom: 20px; background: #fff; box-sizing: border-box; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="background-color: #212529; color: #ffffff; text-align: center; padding: 7px; font-weight: bold; font-size: 11.5px; letter-spacing: 0.3px;">
                    ${c.codigo} - ${c.nombre}
                </div>
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <colgroup>
                        <col style="width: 38px;">
                        <col style="width: calc(50% - 38px);">
                        <col style="width: calc(50% - 38px);">
                        <col style="width: 38px;">
                    </colgroup>
                    <thead>
                        <tr style="text-align: center; font-weight: bold; font-size: 10px; background-color: #f8f9fa;">
                            <th colspan="2" style="border-right: 1.5px solid #212529; border-bottom: 1.5px solid #212529; padding: 5px;">DEBE</th>
                            <th colspan="2" style="border-bottom: 1.5px solid #212529; padding: 5px;">HABER</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const movs = c.movimientos || [];
        const movsDebe = movs.filter(m => parseFloat(m.debe || 0) > 0);
        const movsHaber = movs.filter(m => parseFloat(m.haber || 0) > 0);
        const filasMinimas = Math.max(movsDebe.length, movsHaber.length, 1);

        if (movsDebe.length === 0 && movsHaber.length === 0) {
            html += `
                <tr style="height: 28px;">
                    <td colspan="4" style="text-align: center; color: #6c757d; font-style: italic; font-size: 10px; border-bottom: 1px solid #dee2e6; padding: 6px;">Sin movimientos</td>
                </tr>
            `;
        } else {
            for (let i = 0; i < filasMinimas; i++) {
                const md = movsDebe[i];
                const mh = movsHaber[i];
                let refDebe = '', montoDebe = '', refHaber = '', montoHaber = '';

                if (md) {
                    const dVal = parseFloat(md.debe || 0);
                    const pNum = md.numero_partida || md.partida || '';
                    refDebe = pNum ? `A${pNum}` : '';
                    montoDebe = dVal > 0 ? '$ ' + dVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                }
                if (mh) {
                    const hVal = parseFloat(mh.haber || 0);
                    const pNum = mh.numero_partida || mh.partida || '';
                    refHaber = pNum ? `A${pNum}` : '';
                    montoHaber = hVal > 0 ? '$ ' + hVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                }

                html += `
                    <tr style="height: 24px;">
                        <td style="text-align: center; font-size: 9px; font-weight: bold; color: #6c757d; border-right: 1.5px solid #212529; border-bottom: 1px solid #dee2e6; padding: 3px 2px; background-color: #fcfcfc;">${refDebe}</td>
                        <td style="text-align: right; font-size: 9.5px; border-right: 2px solid #212529; border-bottom: 1px solid #dee2e6; padding: 3px 8px;">${montoDebe}</td>
                        <td style="text-align: right; font-size: 9.5px; border-right: 1.5px solid #212529; border-bottom: 1px solid #dee2e6; padding: 3px 8px;">${montoHaber}</td>
                        <td style="text-align: center; font-size: 9px; font-weight: bold; color: #6c757d; border-bottom: 1px solid #dee2e6; padding: 3px 2px; background-color: #fcfcfc;">${refHaber}</td>
                    </tr>
                `;
            }
        }

        const strTotalDebe = totalDebe > 0 ? '$' + totalDebe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$ 0.00';
        const strTotalHaber = totalHaber > 0 ? '$' + totalHaber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$ 0.00';
        const strSaldo = '$ ' + saldo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        html += `
            <tr style="font-weight: bold; font-size: 9.5px; border-top: 1.5px solid #212529;">
                <td style="border-right: 1.5px solid #212529; border-bottom: 1px solid #dee2e6; padding: 4px 2px;"></td>
                <td style="text-align: right; border-right: 2px solid #212529; border-bottom: 1px solid #dee2e6; padding: 4px 8px;">${strTotalDebe}</td>
                <td style="text-align: right; border-right: 1.5px solid #212529; border-bottom: 1px solid #dee2e6; padding: 4px 8px;">${strTotalHaber}</td>
                <td style="border-bottom: 1px solid #dee2e6; padding: 4px 2px;"></td>
            </tr>
        `;

        if (esDeudora) {
            html += `
                <tr style="font-weight: bold; font-size: 9.5px; background-color: #FCE4D6; border-bottom: 1.5px solid #212529;">
                    <td style="border-right: 1.5px solid #212529; padding: 4px 2px;"></td>
                    <td style="text-align: right; border-right: 2px solid #212529; padding: 4px 8px;">${strSaldo}</td>
                    <td colspan="2" style="text-align: left; padding-left: 8px; padding: 4px 8px;">Saldo deudor</td>
                </tr>
            `;
        } else {
            html += `
                <tr style="font-weight: bold; font-size: 9.5px; background-color: #E2EFDA; border-bottom: 1.5px solid #212529;">
                    <td colspan="2" style="text-align: left; padding-left: 8px; border-right: 1.5px solid #212529; padding: 4px 8px;">Saldo acreedor</td>
                    <td style="text-align: right; border-right: 1.5px solid #212529; padding: 4px 8px;">${strSaldo}</td>
                    <td style="padding: 4px 2px;"></td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
            <div style="background-color: #198754; color: #ffffff; text-align: center; padding: 4px; font-size: 9px; font-weight: bold; letter-spacing: 0.5px;">
                Naturaleza ${c.naturaleza}
            </div>
        </div>
        `;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
    document.body.appendChild(contenedor);

    const opciones = {
        margin:       10,
        filename:     'libro_mayor_cuentas_t.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(contenedor).set(opciones).outputPdf('blob').then((pdfBlob) => {
        document.body.removeChild(contenedor);
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'libro_mayor_cuentas_t.pdf';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    });
}

// Función para Exportar Excel — Formato exacto de Cuentas T (idéntico a la referencia)
function exportarExcel() {
    if (!datosMayor || datosMayor.length === 0) {
        alert('No hay datos en el Libro Mayor para exportar.');
        return;
    }

    const cuentasConDatos = datosMayor.filter(c => {
        const tieneMovs = Array.isArray(c.movimientos) && c.movimientos.length > 0;
        const tieneTotales = parseFloat(c.total_debe || 0) !== 0 ||
                             parseFloat(c.total_haber || 0) !== 0 ||
                             parseFloat(c.saldo || 0) !== 0;
        return tieneMovs || tieneTotales;
    });

    if (cuentasConDatos.length === 0) {
        alert('No hay cuentas con movimientos o saldos para exportar.');
        return;
    }

    const sheetData = [];
    const merges = [];
    const fills = [];
    const estilos = [];
    let rowIndex = 0;

    const BORDE_FINO = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };

    const BORDE_DOBLE_INFERIOR = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'double', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };

    function construirBloqueCuenta(c, maxMovs) {
        const filas = [];

        filas.push({ tipo: 'titulo', celdas: [`${c.codigo} - ${c.nombre}`, '', '', ''] });
        filas.push({ tipo: 'subtitulo', celdas: ['DEBE', '', 'HABER', ''] });

        const movs = c.movimientos || [];
        const movsDebe = movs.filter(m => parseFloat(m.debe || 0) > 0);
        const movsHaber = movs.filter(m => parseFloat(m.haber || 0) > 0);
        const totalFilasMovs = Math.max(movsDebe.length, movsHaber.length, 1);

        if (movsDebe.length === 0 && movsHaber.length === 0) {
            filas.push({ tipo: 'vacio_mov', celdas: ['Sin movimientos', '', '', ''] });
        } else {
            for (let i = 0; i < totalFilasMovs; i++) {
                const md = movsDebe[i];
                const mh = movsHaber[i];
                filas.push({
                    tipo: 'dato',
                    celdas: [
                        md && (md.numero_partida || md.partida) ? `A${md.numero_partida || md.partida}` : '',
                        md ? parseFloat(md.debe || 0) : null,
                        mh ? parseFloat(mh.haber || 0) : null,
                        mh && (mh.numero_partida || mh.partida) ? `A${mh.numero_partida || mh.partida}` : ''
                    ]
                });
            }
        }

        const totalFilasActual = (movsDebe.length === 0 && movsHaber.length === 0) ? 1 : totalFilasMovs;
        for (let i = totalFilasActual; i < maxMovs; i++) {
            filas.push({
                tipo: 'dato',
                celdas: ['', null, null, '']
            });
        }

        const totalDebe = parseFloat(c.total_debe || 0);
        const totalHaber = parseFloat(c.total_haber || 0);
        const saldo = parseFloat(c.saldo || 0);

        let esDeudora;
        if (totalDebe > totalHaber) {
            esDeudora = true;
        } else if (totalHaber > totalDebe) {
            esDeudora = false;
        } else {
            esDeudora = c.naturaleza === 'DEUDORA';
        }

        filas.push({
            tipo: 'total',
            celdas: ['', totalDebe > 0 ? totalDebe : 0, totalHaber > 0 ? totalHaber : 0, '']
        });

        if (esDeudora) {
            filas.push({
                tipo: 'saldo',
                celdas: ['', saldo, 'Saldo deudor', ''],
                naturaleza: 'DEUDORA'
            });
        } else {
            filas.push({
                tipo: 'saldo',
                celdas: ['Saldo acreedor', '', saldo, ''],
                naturaleza: 'ACREEDORA'
            });
        }

        filas.push({ tipo: 'footer_nat', celdas: [`Naturaleza ${c.naturaleza}`, '', '', ''] });

        return { filas, totalFilasMovs: totalFilasActual };
    }

    function registrarFormato(fila, r, colOffset) {
        if (fila.tipo === 'titulo') {
            merges.push({ s: { r, c: colOffset }, e: { r, c: colOffset + 3 } });
            fills.push({ row: r, colStart: colOffset, colEnd: colOffset + 3, color: '212529' });
        } else if (fila.tipo === 'subtitulo') {
            merges.push({ s: { r, c: colOffset }, e: { r, c: colOffset + 1 } });
            merges.push({ s: { r, c: colOffset + 2 }, e: { r, c: colOffset + 3 } });
            fills.push({ row: r, colStart: colOffset, colEnd: colOffset + 3, color: 'F8F9FA' });
        } else if (fila.tipo === 'vacio_mov') {
            merges.push({ s: { r, c: colOffset }, e: { r, c: colOffset + 3 } });
        } else if (fila.tipo === 'saldo') {
            if (fila.naturaleza === 'DEUDORA') {
                merges.push({ s: { r, c: colOffset + 2 }, e: { r, c: colOffset + 3 } });
                fills.push({ row: r, colStart: colOffset, colEnd: colOffset + 3, color: 'FCE4D6' });
            } else {
                merges.push({ s: { r, c: colOffset }, e: { r, c: colOffset + 1 } });
                fills.push({ row: r, colStart: colOffset, colEnd: colOffset + 3, color: 'E2EFDA' });
            }
        } else if (fila.tipo === 'footer_nat') {
            merges.push({ s: { r, c: colOffset }, e: { r, c: colOffset + 3 } });
            fills.push({ row: r, colStart: colOffset, colEnd: colOffset + 3, color: '198754' });
        }

        for (let c = colOffset; c <= colOffset + 3; c++) {
            let align = { vertical: 'center', horizontal: 'center' };
            if (c === colOffset + 1 || c === colOffset + 2) {
                if (fila.tipo === 'dato' || fila.tipo === 'total' || fila.tipo === 'saldo') {
                    align.horizontal = 'right';
                }
            }
            if (fila.tipo === 'saldo') {
                if (fila.naturaleza === 'DEUDORA' && c === colOffset + 2) align.horizontal = 'left';
                if (fila.naturaleza === 'ACREEDORA' && c === colOffset) align.horizontal = 'left';
            }
            if (fila.tipo === 'vacio_mov' || fila.tipo === 'footer_nat' || fila.tipo === 'titulo') {
                align.horizontal = 'center';
            }

            const esNegrita = true;
            const borderStyle = fila.tipo === 'total' ? BORDE_DOBLE_INFERIOR : BORDE_FINO;
            estilos.push({ row: r, col: c, bold: esNegrita, alignment: align, border: borderStyle });
        }
    }

    for (let i = 0; i < cuentasConDatos.length; i += 2) {
        const c1 = cuentasConDatos[i];
        const c2 = cuentasConDatos[i + 1] || null;

        const getMovCount = (acc) => {
            if (!acc || !acc.movimientos) return 1;
            const d = acc.movimientos.filter(m => parseFloat(m.debe || 0) > 0).length;
            const h = acc.movimientos.filter(m => parseFloat(m.haber || 0) > 0).length;
            return Math.max(d, h, 1);
        };

        const maxMovs = Math.max(getMovCount(c1), c2 ? getMovCount(c2) : 1);

        const bloque1 = construirBloqueCuenta(c1, maxMovs);
        const bloque2 = c2 ? construirBloqueCuenta(c2, maxMovs) : null;

        const totalFilasBloque = bloque1.filas.length;

        for (let f = 0; f < totalFilasBloque; f++) {
            const f1 = bloque1.filas[f];
            const f2 = bloque2 ? bloque2.filas[f] : { tipo: 'vacio', celdas: ['', null, null, ''] };

            sheetData.push([...f1.celdas, '', ...f2.celdas]);
            
            registrarFormato(f1, rowIndex, 0);
            if (c2) {
                registrarFormato(f2, rowIndex, 5);
            }
            rowIndex++;
        }

        sheetData.push([]);
        rowIndex++;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!merges'] = merges;

    worksheet['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 18 },
        { wch: 6 },
        { wch: 3 },
        { wch: 6 },
        { wch: 18 },
        { wch: 18 },
        { wch: 6 }
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[addr];
            if (cell && typeof cell.v === 'number') {
                cell.z = '"$"#,##0.00';
            }
        }
    }

    estilos.forEach(({ row, col, bold, alignment, border }) => {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[addr]) worksheet[addr] = { t: 's', v: '' };

        const existingFill = worksheet[addr].s ? worksheet[addr].s.fill : undefined;
        let fontColor = '000000';
        if (existingFill && existingFill.fgColor) {
            if (existingFill.fgColor.rgb === '212529' || existingFill.fgColor.rgb === '198754') {
                fontColor = 'FFFFFF';
            }
        }

        worksheet[addr].s = Object.assign({}, worksheet[addr].s, {
            border: border,
            font: { bold: !!bold, name: 'Arial', sz: 10, color: { rgb: fontColor } },
            alignment: alignment
        });
    });

    fills.forEach(({ row, colStart, colEnd, color }) => {
        for (let C = colStart; C <= colEnd; C++) {
            const addr = XLSX.utils.encode_cell({ r: row, c: C });
            if (!worksheet[addr]) worksheet[addr] = { t: 's', v: '' };
            worksheet[addr].s = Object.assign({}, worksheet[addr].s, {
                fill: { patternType: 'solid', fgColor: { rgb: color } }
            });
        }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Libro Mayor T");
    XLSX.writeFile(workbook, "Libro_Mayor_Cuentas_T.xlsx");
}

// Limpiar Libro Mayor (Eliminar todas las partidas del diario)
async function limpiarMayor() {
    if (!confirm('¿Estás seguro de LIMPIAR el Libro Mayor?\n\nEsto eliminará todas las partidas registradas en el Libro Diario y dejará todos los saldos en $0.00.')) {
        return;
    }

    try {
        const res = await fetch('/api/partidas', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            await cargarLibroMayor();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error al limpiar mayor:', err);
        alert('Error de conexión al limpiar el Libro Mayor.');
    }
}