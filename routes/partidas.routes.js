const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/partidas/siguiente-numero - Obtener el correlativo de la próxima partida
router.get('/siguiente-numero', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT COALESCE(MAX(numero_partida), 0) + 1 AS siguiente FROM partidas`);
    res.json({ success: true, siguienteNumero: rows[0].siguiente });
  } catch (error) {
    console.error('Error al obtener correlativo:', error);
    res.status(500).json({ success: false, message: 'Error al obtener correlativo de partida.', error: error.message });
  }
});

// GET /api/partidas - Listar todas las partidas con su detalle de asientos (incluye parcial)
router.get('/', async (req, res) => {
  try {
    const [partidas] = await db.query(
      `SELECT id, numero_partida, fecha, concepto, created_at 
       FROM partidas 
       ORDER BY numero_partida ASC, fecha ASC`
    );

    for (let partida of partidas) {
      const [detalles] = await db.query(
        `SELECT d.id, d.cuenta_id, c.codigo, c.nombre AS cuenta_nombre, c.naturaleza, d.parcial, d.debe, d.haber
         FROM detalle_asiento d
         INNER JOIN catalogo_cuentas c ON d.cuenta_id = c.id
         WHERE d.partida_id = ?
         ORDER BY d.id ASC`,
        [partida.id]
      );
      partida.detalles = detalles;
    }

    res.json({ success: true, partidas });
  } catch (error) {
    console.error('Error al obtener libro diario:', error);
    res.status(500).json({ success: false, message: 'Error al cargar el Libro Diario.', error: error.message });
  }
});

// POST /api/partidas - Registrar partida con validación flexible de Parcial, Debe y Haber
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { numero_partida, fecha, concepto, detalles } = req.body;

    // 1. Validaciones básicas de campos
    if (!fecha || !concepto || !concepto.trim()) {
      return res.status(400).json({ success: false, message: 'La fecha y el concepto son obligatorios.' });
    }

    if (!Array.isArray(detalles) || detalles.length < 2) {
      return res.status(400).json({ success: false, message: 'Una partida debe contener al menos dos movimientos contables.' });
    }

    // 2. Validación estricta de Partida Doble
    let totalDebe = 0;
    let totalHaber = 0;

    for (let i = 0; i < detalles.length; i++) {
      const det = detalles[i];
      if (!det.cuenta_id) {
        return res.status(400).json({ success: false, message: `Línea #${i + 1}: Debe seleccionar una cuenta contable.` });
      }

      const parcialVal = parseFloat(det.parcial || 0);
      const debeVal = parseFloat(det.debe || 0);
      const haberVal = parseFloat(det.haber || 0);

      if (isNaN(parcialVal) || isNaN(debeVal) || isNaN(haberVal) || parcialVal < 0 || debeVal < 0 || haberVal < 0) {
        return res.status(400).json({ success: false, message: `Línea #${i + 1}: Los montos no pueden ser negativos ni texto inválido.` });
      }

      // PERMITIR QUE EL MONTO SEA MAYOR A 0 EN PARCIAL, DEBE O HABER
      if (parcialVal === 0 && debeVal === 0 && haberVal === 0) {
        return res.status(400).json({ success: false, message: `Línea #${i + 1}: Debe ingresar un monto en Parcial, Debe o Haber.` });
      }

      totalDebe += debeVal;
      totalHaber += haberVal;
    }

    // Redondear a 2 decimales para evitar problemas de coma flotante
    totalDebe = Math.round(totalDebe * 100) / 100;
    totalHaber = Math.round(totalHaber * 100) / 100;

    if (totalDebe <= 0) {
      return res.status(400).json({ success: false, message: 'El total del Debe debe ser mayor a 0.00.' });
    }

    if (totalDebe !== totalHaber) {
      return res.status(400).json({
        success: false,
        message: `¡Error de Partida Doble! La suma del Debe ($${totalDebe.toFixed(2)}) no es igual a la suma del Haber ($${totalHaber.toFixed(2)}). Diferencia: $${Math.abs(totalDebe - totalHaber).toFixed(2)}.`
      });
    }

    // 3. Determinar número de partida si no viene especificado
    let numPartida = parseInt(numero_partida, 10);
    if (isNaN(numPartida) || numPartida <= 0) {
      const [maxRow] = await connection.query(`SELECT COALESCE(MAX(numero_partida), 0) + 1 AS siguiente FROM partidas`);
      numPartida = maxRow[0].siguiente;
    }

    // 4. Iniciar Transacción SQL
    await connection.beginTransaction();

    // Insertar encabezado en `partidas`
    const [partidaResult] = await connection.query(
      `INSERT INTO partidas (numero_partida, fecha, concepto) VALUES (?, ?, ?)`,
      [numPartida, fecha, concepto.trim()]
    );

    const partidaId = partidaResult.insertId;

    // Insertar cada renglón en `detalle_asiento` guardando el campo `parcial`
    for (let det of detalles) {
      const parcialVal = parseFloat(det.parcial || 0);
      const debeVal = parseFloat(det.debe || 0);
      const haberVal = parseFloat(det.haber || 0);

      await connection.query(
        `INSERT INTO detalle_asiento (partida_id, cuenta_id, parcial, debe, haber) VALUES (?, ?, ?, ?, ?)`,
        [partidaId, parseInt(det.cuenta_id, 10), parcialVal, debeVal, haberVal]
      );
    }

    // Confirmar transacción
    await connection.commit();

    res.status(201).json({
      success: true,
      message: `Partida N° ${numPartida} registrada exitosamente cumpliendo la regla de Partida Doble.`,
      partidaId,
      numero_partida: numPartida
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al registrar partida:', error);
    res.status(500).json({ success: false, message: 'Error interno al guardar la partida.', error: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/partidas/ajuste-inventarios - Generar automáticamente los asientos de igualación de inventarios
router.post('/ajuste-inventarios', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { fecha, inventario_final } = req.body;
    const invFinal = parseFloat(inventario_final);

    if (isNaN(invFinal) || invFinal < 0) {
      return res.status(400).json({ success: false, message: 'El valor del Inventario Final debe ser un número mayor o igual a 0.00.' });
    }

    const fechaAjuste = fecha || new Date().toISOString().split('T')[0];

    // Obtener IDs de las cuentas necesarias (1103 Inventarios, 4101 Costo de Ventas, 4102 Compras)
    const [cuentas] = await connection.query(
      `SELECT id, codigo FROM catalogo_cuentas WHERE codigo IN ('1103', '4101', '4102')`
    );
    const cuentaMap = {};
    cuentas.forEach(c => { cuentaMap[c.codigo] = c.id; });

    if (!cuentaMap['1103'] || !cuentaMap['4101'] || !cuentaMap['4102']) {
      return res.status(400).json({
        success: false, 
        message: 'Faltan cuentas necesarias en el catálogo (1103 Inventarios, 4101 Costo de Ventas o 4102 Compras).'
      });
    }

    // Consultar saldo actual de Inventarios (1103) y Compras (4102)
    const [invRows] = await connection.query(
      `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM detalle_asiento WHERE cuenta_id = ?`,
      [cuentaMap['1103']]
    );
    const invInicial = Math.round(parseFloat(invRows[0].saldo) * 100) / 100;

    const [comprasRows] = await connection.query(
      `SELECT COALESCE(SUM(debe - haber), 0) AS saldo FROM detalle_asiento WHERE cuenta_id = ?`,
      [cuentaMap['4102']]
    );
    const comprasNetas = Math.round(parseFloat(comprasRows[0].saldo) * 100) / 100;

    const mercanciaDisponible = Math.round((invInicial + comprasNetas) * 100) / 100;
    const costoVentas = Math.round((mercanciaDisponible - invFinal) * 100) / 100;

    if (mercanciaDisponible <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay saldo en Inventarios ni en Compras disponible para realizar la igualación.'
      });
    }

    if (costoVentas < 0) {
      return res.status(400).json({
        success: false,
        message: `El Inventario Final ($${invFinal.toFixed(2)}) no puede superar la Mercancía Disponible ($${mercanciaDisponible.toFixed(2)}).`
      });
    }

    // Iniciar transacción
    await connection.beginTransaction();

    const [maxRow] = await connection.query(`SELECT COALESCE(MAX(numero_partida), 0) AS max_num FROM partidas`);
    let numPartida = maxRow[0].max_num + 1;
    const partidasCreadas = [];

    // Asiento 1: Traspaso de Inventario Inicial a Compras (Mercancía Disponible)
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
      partidasCreadas.push({ numero: numPartida, descripcion: 'Mercancía Disponible', monto: invInicial });
      numPartida++;
    }

    // Asiento 2: Registro del Inventario Final Físico deduciéndolo de Compras
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
      partidasCreadas.push({ numero: numPartida, descripcion: 'Inventario Final', monto: invFinal });
      numPartida++;
    }

    await connection.commit();

    res.json({
      success: true,
      message: `¡Asientos de ajuste de inventarios generados exitosamente! (${partidasCreadas.length} partidas creadas)`,
      invInicial,
      comprasNetas,
      mercanciaDisponible,
      invFinal,
      costoVentas,
      partidasCreadas
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error al generar ajustes de inventario:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar los ajustes.', error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/partidas/:id - Eliminar una partida individual
router.delete('/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const id = parseInt(req.params.id, 10);
    const [partida] = await connection.query('SELECT numero_partida FROM partidas WHERE id = ?', [id]);
    if (partida.length === 0) {
      return res.status(404).json({ success: false, message: 'Partida no encontrada.' });
    }

    const num = partida[0].numero_partida;
    await connection.beginTransaction();
    await connection.query('DELETE FROM detalle_asiento WHERE partida_id = ?', [id]);
    await connection.query('DELETE FROM partidas WHERE id = ?', [id]);
    await connection.commit();

    res.json({ success: true, message: `Partida N° ${num} eliminada exitosamente.` });
  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar partida:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar la partida.', error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/partidas - Vaciar todas las partidas del Libro Diario
router.delete('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM detalle_asiento');
    await connection.query('DELETE FROM partidas');
    await connection.query('ALTER TABLE partidas AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE detalle_asiento AUTO_INCREMENT = 1');
    await connection.commit();

    res.json({ success: true, message: 'Libro Diario vaciado exitosamente. Se eliminaron todas las partidas.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al vaciar Libro Diario:', error);
    res.status(500).json({ success: false, message: 'Error al vaciar Libro Diario.', error: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/partidas/restablecer-demo - Recargar ejercicio demo predeterminado
router.post('/restablecer-demo', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM detalle_asiento');
    await connection.query('DELETE FROM partidas');
    await connection.query('ALTER TABLE partidas AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE detalle_asiento AUTO_INCREMENT = 1');

    const [cuentas] = await connection.query('SELECT id, codigo FROM catalogo_cuentas');
    const cuentaMap = {};
    cuentas.forEach(c => { cuentaMap[c.codigo] = c.id; });

    const transacciones = [
      {
        numero: 1, fecha: '2026-01-01',
        concepto: 'Asiento de apertura: Aporte de socios con efectivo, inventario inicial de mercaderías y mobiliario de oficina.',
        detalles: [
          { cuenta: '1101', debe: 20000, haber: 0 },
          { cuenta: '1103', debe: 10000, haber: 0 },
          { cuenta: '1202', debe: 5000, haber: 0 },
          { cuenta: '3101', debe: 0, haber: 35000 }
        ]
      },
      {
        numero: 2, fecha: '2026-01-05',
        concepto: 'Compra de mercadería para la venta, pagando una parte en efectivo y el resto a crédito comercial.',
        detalles: [
          { cuenta: '4102', debe: 15000, haber: 0 },
          { cuenta: '1101', debe: 0, haber: 5000 },
          { cuenta: '2101', debe: 0, haber: 10000 }
        ]
      },
      {
        numero: 3, fecha: '2026-01-15',
        concepto: 'Venta de mercaderías al contado recibiendo transferencia bancaria.',
        detalles: [
          { cuenta: '1101', debe: 30000, haber: 0 },
          { cuenta: '5101', debe: 0, haber: 30000 }
        ]
      },
      {
        numero: 4, fecha: '2026-01-25',
        concepto: 'Pago de sueldos y salarios del personal y gastos administrativos del mes en efectivo.',
        detalles: [
          { cuenta: '4204', debe: 3000, haber: 0 },
          { cuenta: '4201', debe: 1500, haber: 0 },
          { cuenta: '1101', debe: 0, haber: 4500 }
        ]
      },
      {
        numero: 5, fecha: '2026-01-31',
        concepto: 'Ajuste 1: Traspaso del Inventario Inicial a la cuenta Compras para determinar la Mercancía Disponible para la venta.',
        detalles: [
          { cuenta: '4102', debe: 10000, haber: 0 },
          { cuenta: '1103', debe: 0, haber: 10000 }
        ]
      },
      {
        numero: 6, fecha: '2026-01-31',
        concepto: 'Ajuste 2: Registro del Inventario Final físico ($6,000.00) deduciéndolo de Compras para determinar el Costo de Venta.',
        detalles: [
          { cuenta: '1103', debe: 6000, haber: 0 },
          { cuenta: '4102', debe: 0, haber: 6000 }
        ]
      }
    ];

    for (let t of transacciones) {
      const [resPartida] = await connection.query(
        'INSERT INTO partidas (numero_partida, fecha, concepto) VALUES (?, ?, ?)',
        [t.numero, t.fecha, t.concepto]
      );
      for (let d of t.detalles) {
        const cuentaId = cuentaMap[d.cuenta];
        await connection.query(
          'INSERT INTO detalle_asiento (partida_id, cuenta_id, parcial, debe, haber) VALUES (?, ?, 0.00, ?, ?)',
          [resPartida.insertId, cuentaId, d.debe, d.haber]
        );
      }
    }

    // Restablecer también Kardex demo
    await connection.query('DELETE FROM kardex');
    const kardexMovs = [
      ['Mercadería General', 'PROMEDIO', '2026-01-01', 'Inventario Inicial de mercaderías según balance de apertura', 'INICIAL', 1000.00, 0.00, 1000.00, 10.0000, 10.0000, 10000.00, 0.00, 10000.00],
      ['Mercadería General', 'PROMEDIO', '2026-01-05', 'Compra según Factura N° 101 a proveedor comercial', 'ENTRADA', 1200.00, 0.00, 2200.00, 12.5000, 11.3636, 15000.00, 0.00, 25000.00],
      ['Mercadería General', 'PROMEDIO', '2026-01-15', 'Salida por costo de venta de mercadería vendida según Factura N° 201', 'SALIDA', 0.00, 1600.00, 600.00, 11.8750, 10.0000, 0.00, 19000.00, 6000.00]
    ];
    for (let km of kardexMovs) {
      await connection.query(
        `INSERT INTO kardex (producto, metodo, fecha, detalle, tipo_movimiento, cant_entrada, cant_salida, cant_saldo, costo_unitario, costo_promedio, debe, haber, saldo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        km
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Ejercicio demo cargado exitosamente en Diario, Mayor, Estados y Kardex.' });
  } catch (error) {
    await connection.rollback();
    console.error('Error al restablecer demo:', error);
    res.status(500).json({ success: false, message: 'Error al restablecer demo.', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;