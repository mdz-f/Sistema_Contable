const express = require('express');
const router = express.Router();
const db = require('../db');

// Función auxiliar para recalcular saldos encadenados de Kardex
async function recalcularKardex(connection) {
  const [rows] = await connection.query(`SELECT * FROM kardex ORDER BY fecha ASC, id ASC`);
  let saldoCant = 0;
  let saldoDinero = 0;

  for (let row of rows) {
    const cantEntrada = parseFloat(row.cant_entrada) || 0;
    const cantSalida = parseFloat(row.cant_salida) || 0;
    let cu = parseFloat(row.costo_unitario) || 0;
    let debe = parseFloat(row.debe) || 0;
    let haber = parseFloat(row.haber) || 0;

    if (row.tipo_movimiento === 'INICIAL' || row.tipo_movimiento === 'ENTRADA' || row.tipo_movimiento === 'DEV_VENTA') {
      saldoCant += cantEntrada;
      if (debe === 0 && cu > 0) debe = cantEntrada * cu;
      saldoDinero += debe;
    } else if (row.tipo_movimiento === 'SALIDA' || row.tipo_movimiento === 'DEV_COMPRA') {
      // Si no especificó costo unitario o haber, usar costo promedio vigente
      const cuPromedioVigente = saldoCant > 0 ? (saldoDinero / saldoCant) : 0;
      if (cu === 0) cu = cuPromedioVigente;
      if (haber === 0 && cu > 0) haber = cantSalida * cu;

      saldoCant -= cantSalida;
      saldoDinero -= haber;
    }

    saldoCant = Math.round(saldoCant * 100) / 100;
    saldoDinero = Math.round(saldoDinero * 100) / 100;
    const costoPromedio = saldoCant > 0 ? Math.round((saldoDinero / saldoCant) * 10000) / 10000 : 0;

    await connection.query(
      `UPDATE kardex 
       SET cant_saldo = ?, costo_unitario = ?, costo_promedio = ?, debe = ?, haber = ?, saldo = ?
       WHERE id = ?`,
      [saldoCant, cu, costoPromedio, debe, haber, saldoDinero, row.id]
    );
  }
}

// GET /api/kardex - Listar movimientos y resumen general
router.get('/', async (req, res) => {
  try {
    const [movimientos] = await db.query(`SELECT * FROM kardex ORDER BY fecha ASC, id ASC`);

    let totalEntradasCant = 0;
    let totalSalidasCant = 0;
    let totalDebe = 0;
    let totalHaber = 0;

    movimientos.forEach(m => {
      totalEntradasCant += parseFloat(m.cant_entrada) || 0;
      totalSalidasCant += parseFloat(m.cant_salida) || 0;
      totalDebe += parseFloat(m.debe) || 0;
      totalHaber += parseFloat(m.haber) || 0;
    });

    const ultimo = movimientos.length > 0 ? movimientos[movimientos.length - 1] : null;
    const inventarioFinalCant = ultimo ? parseFloat(ultimo.cant_saldo) : 0;
    const inventarioFinalDinero = ultimo ? parseFloat(ultimo.saldo) : 0;
    const costoPromedioActual = ultimo ? parseFloat(ultimo.costo_promedio) : 0;

    res.json({
      success: true,
      movimientos,
      resumen: {
        totalEntradasCant,
        totalSalidasCant,
        totalDebe: Math.round(totalDebe * 100) / 100,
        totalHaber: Math.round(totalHaber * 100) / 100, // Costo de Ventas neto
        inventarioFinalCant,
        inventarioFinalDinero: Math.round(inventarioFinalDinero * 100) / 100,
        costoPromedioActual
      }
    });
  } catch (error) {
    console.error('Error al obtener kardex:', error);
    res.status(500).json({ success: false, message: 'Error al consultar el Kardex.', error: error.message });
  }
});

// POST /api/kardex - Registrar movimiento manual de almacén
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      fecha,
      detalle,
      tipo_movimiento,
      cantidad,
      costo_unitario,
      haber_personalizado,
      metodo = 'PROMEDIO',
      producto = 'Mercadería General'
    } = req.body;

    const cant = parseFloat(cantidad);
    let cu = parseFloat(costo_unitario) || 0;

    if (!fecha || !detalle || !detalle.trim()) {
      return res.status(400).json({ success: false, message: 'La fecha y el detalle son obligatorios.' });
    }

    if (isNaN(cant) || cant <= 0) {
      return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0.' });
    }

    if (!['INICIAL', 'ENTRADA', 'SALIDA', 'DEV_COMPRA', 'DEV_VENTA'].includes(tipo_movimiento)) {
      return res.status(400).json({
        success: false, 
        message: 'Tipo de movimiento inválido (INICIAL, ENTRADA, SALIDA, DEV_COMPRA, DEV_VENTA).' 
      });
    }

    let cantEntrada = 0;
    let cantSalida = 0;
    let debe = 0;
    let haber = 0;

    // Obtener último saldo registrado para validar y calcular
    const [ultimos] = await connection.query(`SELECT cant_saldo, saldo, costo_promedio FROM kardex ORDER BY fecha DESC, id DESC LIMIT 1`);
    const saldoCantPrevio = ultimos.length > 0 ? parseFloat(ultimos[0].cant_saldo) : 0;
    const saldoDineroPrevio = ultimos.length > 0 ? parseFloat(ultimos[0].saldo) : 0;
    const costoPromedioPrevio = ultimos.length > 0 ? parseFloat(ultimos[0].costo_promedio) : 0;

    if (tipo_movimiento === 'INICIAL' || tipo_movimiento === 'ENTRADA') {
      if (cu <= 0) {
        return res.status(400).json({ success: false, message: 'Para entradas o inventario inicial, el costo unitario debe ser mayor a 0.00.' });
      }
      cantEntrada = cant;
      debe = Math.round(cantEntrada * cu * 100) / 100;

    } else if (tipo_movimiento === 'DEV_VENTA') {
      // Devolución sobre Venta: Reingresan unidades a almacén al costo al que habían salido
      cantEntrada = cant;
      if (cu <= 0) {
        cu = costoPromedioPrevio > 0 ? costoPromedioPrevio : (saldoCantPrevio > 0 ? saldoDineroPrevio / saldoCantPrevio : 0);
      }
      debe = Math.round(cantEntrada * cu * 100) / 100;

    } else if (tipo_movimiento === 'DEV_COMPRA') {
      // Devolución sobre Compra: Salen unidades hacia el proveedor al costo de adquisición
      if (cant > saldoCantPrevio) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para devolver. Tienes ${saldoCantPrevio} unidades en bodega y deseas devolver ${cant} unidades.`
        });
      }
      cantSalida = cant;
      if (cu <= 0) {
        cu = costoPromedioPrevio > 0 ? costoPromedioPrevio : (saldoCantPrevio > 0 ? saldoDineroPrevio / saldoCantPrevio : 0);
      }
      haber = Math.round(cantSalida * cu * 100) / 100;

    } else {
      // SALIDA (Venta normal)
      if (cant > saldoCantPrevio) {
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente. Tienes ${saldoCantPrevio} unidades disponibles y deseas registrar una salida de ${cant} unidades.`
        });
      }
      cantSalida = cant;

      if (haber_personalizado && parseFloat(haber_personalizado) > 0) {
        haber = Math.round(parseFloat(haber_personalizado) * 100) / 100;
        cu = Math.round((haber / cantSalida) * 10000) / 10000;
      } else {
        if (cu <= 0) {
          cu = costoPromedioPrevio > 0 ? costoPromedioPrevio : (saldoCantPrevio > 0 ? saldoDineroPrevio / saldoCantPrevio : 0);
        }
        haber = Math.round(cantSalida * cu * 100) / 100;
      }
    }

    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `INSERT INTO kardex (producto, metodo, fecha, detalle, tipo_movimiento, cant_entrada, cant_salida, costo_unitario, debe, haber)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [producto.trim(), metodo, fecha, detalle.trim(), tipo_movimiento, cantEntrada, cantSalida, cu, debe, haber]
    );

    // Recalcular todos los saldos ordenados por fecha e ID
    await recalcularKardex(connection);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Movimiento de Kardex registrado exitosamente.',
      id: insertResult.insertId
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar en kardex:', error);
    res.status(500).json({ success: false, message: 'Error interno al registrar en Kardex.', error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/kardex/:id - Eliminar un movimiento individual
router.delete('/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = parseInt(req.params.id, 10);
    await connection.beginTransaction();

    await connection.query(`DELETE FROM kardex WHERE id = ?`, [id]);
    await recalcularKardex(connection);

    await connection.commit();
    res.json({ success: true, message: 'Movimiento eliminado y saldos recalculados correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar movimiento de kardex:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar movimiento.', error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/kardex - Vaciar todo el kardex (reiniciar ejercicio)
router.delete('/', async (req, res) => {
  try {
    await db.query(`TRUNCATE TABLE kardex`);
    res.json({ success: true, message: 'Kardex vaciado completamente.' });
  } catch (error) {
    console.error('Error al vaciar kardex:', error);
    res.status(500).json({ success: false, message: 'Error al vaciar kardex.', error: error.message });
  }
});

module.exports = router;
