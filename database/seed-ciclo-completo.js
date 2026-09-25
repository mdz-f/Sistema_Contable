const pool = require('../db');

async function seedCicloCompleto() {
  const connection = await pool.getConnection();
  try {
    console.log('🚀 Iniciando registro del Ciclo Contable con Asientos de Ajuste de Inventario...');
    await connection.beginTransaction();

    // Limpiar partidas anteriores si las hubiera
    await connection.query('DELETE FROM detalle_asiento');
    await connection.query('DELETE FROM partidas');
    await connection.query('ALTER TABLE partidas AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE detalle_asiento AUTO_INCREMENT = 1');

    // Mapeo de cuentas por código
    const [cuentas] = await connection.query('SELECT id, codigo FROM catalogo_cuentas');
    const cuentaMap = {};
    cuentas.forEach(c => { cuentaMap[c.codigo] = c.id; });

    // Definición de las 7 partidas
    const transacciones = [
      {
        numero: 1,
        fecha: '2026-01-01',
        concepto: 'Asiento de apertura: Aporte de socios con efectivo, inventario inicial de mercaderías y mobiliario de oficina.',
        detalles: [
          { cuenta: '1101', debe: 20000, haber: 0 },
          { cuenta: '1103', debe: 10000, haber: 0 },
          { cuenta: '1202', debe: 5000, haber: 0 },
          { cuenta: '3101', debe: 0, haber: 35000 }
        ]
      },
      {
        numero: 2,
        fecha: '2026-01-05',
        concepto: 'Compra de mercadería para la venta, pagando una parte en efectivo y el resto a crédito comercial.',
        detalles: [
          { cuenta: '4102', debe: 15000, haber: 0 },
          { cuenta: '1101', debe: 0, haber: 5000 },
          { cuenta: '2101', debe: 0, haber: 10000 }
        ]
      },
      {
        numero: 3,
        fecha: '2026-01-15',
        concepto: 'Venta de mercaderías al contado recibiendo transferencia bancaria.',
        detalles: [
          { cuenta: '1101', debe: 30000, haber: 0 },
          { cuenta: '5101', debe: 0, haber: 30000 }
        ]
      },
      {
        numero: 4,
        fecha: '2026-01-25',
        concepto: 'Pago de sueldos y salarios del personal y gastos administrativos del mes en efectivo.',
        detalles: [
          { cuenta: '4204', debe: 3000, haber: 0 },
          { cuenta: '4201', debe: 1500, haber: 0 },
          { cuenta: '1101', debe: 0, haber: 4500 }
        ]
      },
      {
        numero: 5,
        fecha: '2026-01-31',
        concepto: 'Ajuste 1: Traspaso del Inventario Inicial a la cuenta Compras para determinar la Mercancía Disponible para la venta.',
        detalles: [
          { cuenta: '4102', debe: 10000, haber: 0 },
          { cuenta: '1103', debe: 0, haber: 10000 }
        ]
      },
      {
        numero: 6,
        fecha: '2026-01-31',
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
      const partidaId = resPartida.insertId;

      for (let d of t.detalles) {
        const cuentaId = cuentaMap[d.cuenta];
        await connection.query(
          'INSERT INTO detalle_asiento (partida_id, cuenta_id, parcial, debe, haber) VALUES (?, ?, 0.00, ?, ?)',
          [partidaId, cuentaId, d.debe, d.haber]
        );
      }
      console.log(`  ✅ Partida N° ${t.numero} registrada exitosamente.`);
    }

    // Poblar Kardex de Almacén correspondiente
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
    console.log('  📦 Movimientos del Kardex registrados exitosamente.');

    await connection.commit();
    console.log('\n🎉 ¡Ciclo contable completo, asientos y Kardex registrados con éxito!');
    process.exit(0);

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al registrar partidas:', error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

seedCicloCompleto();
