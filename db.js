const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbDir = __dirname;
try {
  const { app } = require('electron');
  if (app && typeof app.getPath === 'function') {
    dbDir = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData');
  }
} catch (e) {}

if (!fs.existsSync(dbDir)) {
  try { fs.mkdirSync(dbDir, { recursive: true }); } catch(e){}
}

const dbPath = path.join(dbDir, 'sistema_contable.db');
const sqlite = new Database(dbPath);

try {
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
} catch(e) {}

function executeQuery(sql, params = []) {
  const cleanSql = sql.trim();
  const upperSql = cleanSql.toUpperCase();

  if (upperSql.includes('AUTO_INCREMENT')) {
    const match = cleanSql.match(/ALTER\s+TABLE\s+([`\w]+)/i);
    if (match && match[1]) {
      const tableName = match[1].replace(/[`]/g, '');
      try {
        sqlite.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(tableName);
      } catch(e){}
      return [{ insertId: 0, affectedRows: 0 }];
    }
  }

  const stmt = sqlite.prepare(sql);

  if (upperSql.startsWith('SELECT')) {
    const rows = stmt.all(...params);
    return [rows];
  } else {
    const result = stmt.run(...params);
    return [{
      insertId: Number(result.lastInsertRowid),
      affectedRows: result.changes,
      changedRows: result.changes
    }];
  }
}

const wrapper = {
  query: async (sql, params = []) => executeQuery(sql, params),
  getConnection: async () => {
    return {
      query: async (sql, params = []) => executeQuery(sql, params),
      beginTransaction: async () => sqlite.exec('BEGIN TRANSACTION'),
      commit: async () => sqlite.exec('COMMIT'),
      rollback: async () => sqlite.exec('ROLLBACK'),
      release: () => {}
    };
  }
};

console.log(`⚡ Conexión exitosa a la base de datos SQLite (${dbPath})`);

(async () => {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol_id INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS catalogo_cuentas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        tipo INTEGER NOT NULL,
        naturaleza TEXT CHECK(naturaleza IN ('DEUDORA', 'ACREEDORA')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS partidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_partida INTEGER UNIQUE NOT NULL,
        fecha TEXT NOT NULL,
        concepto TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS detalle_asiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partida_id INTEGER NOT NULL,
        cuenta_id INTEGER NOT NULL,
        parcial REAL DEFAULT 0.00,
        debe REAL DEFAULT 0.00,
        haber REAL DEFAULT 0.00,
        FOREIGN KEY(partida_id) REFERENCES partidas(id) ON DELETE CASCADE,
        FOREIGN KEY(cuenta_id) REFERENCES catalogo_cuentas(id)
      );

      CREATE TABLE IF NOT EXISTS kardex (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto TEXT DEFAULT 'Mercadería General',
        metodo TEXT DEFAULT 'PROMEDIO',
        fecha TEXT NOT NULL,
        detalle TEXT NOT NULL,
        tipo_movimiento TEXT NOT NULL,
        cant_entrada REAL DEFAULT 0.00,
        cant_salida REAL DEFAULT 0.00,
        cant_saldo REAL DEFAULT 0.00,
        costo_unitario REAL DEFAULT 0.00,
        costo_promedio REAL DEFAULT 0.00,
        debe REAL DEFAULT 0.00,
        haber REAL DEFAULT 0.00,
        saldo REAL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS config (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);

    const [rows] = await wrapper.query('SELECT COUNT(*) AS count FROM catalogo_cuentas');
    if (rows[0].count === 0) {
      console.log('📦 Inicializando catálogo de 52 cuentas contables en SQLite...');
      const cuentas = [
        ['1101', 'Efectivo y Equivalentes de Efectivo', 1, 'DEUDORA'],
        ['110101', 'Caja', 1, 'DEUDORA'],
        ['110102', 'Bancos', 1, 'DEUDORA'],
        ['1102', 'Cuentas por Cobrar Comerciales', 1, 'DEUDORA'],
        ['110201', 'Clientes', 1, 'DEUDORA'],
        ['1103', 'Inventarios / Mercaderías', 1, 'DEUDORA'],
        ['1104', 'IVA - Crédito Fiscal', 1, 'DEUDORA'],
        ['1105', 'Remanente de Crédito Fiscal (IVA a Favor)', 1, 'DEUDORA'],
        ['110501', 'Remanente de Crédito Fiscal (IVA a Favor)', 1, 'DEUDORA'],
        ['1106', 'Anticipo a Cuenta de IVA (Percepción 1%)', 1, 'DEUDORA'],
        ['1107', 'Gastos Pagados por Anticipado', 1, 'DEUDORA'],
        ['110701', 'Papelería y Útiles', 1, 'DEUDORA'],
        ['110702', 'Alquiler', 1, 'DEUDORA'],
        ['110703', 'Otros Gastos', 1, 'DEUDORA'],
        ['1108', 'Seguros Pagados por Anticipado', 1, 'DEUDORA'],
        ['1109', 'Alquileres Pagados por Anticipado', 1, 'DEUDORA'],
        ['1201', 'Propiedad, Planta y Equipo', 1, 'DEUDORA'],
        ['120101', 'Edificios', 1, 'DEUDORA'],
        ['120103', 'Equipo de Cómputo', 1, 'DEUDORA'],
        ['1202', 'Mobiliario y Equipo de Oficina', 1, 'DEUDORA'],
        ['1203', 'Equipo de Transporte', 1, 'DEUDORA'],
        ['2101', 'Cuentas por Pagar Comerciales', 2, 'ACREEDORA'],
        ['210101', 'Proveedores', 2, 'ACREEDORA'],
        ['2102', 'Préstamos Bancarios a Corto Plazo', 2, 'ACREEDORA'],
        ['2103', 'Impuestos y Retenciones por Pagar', 2, 'ACREEDORA'],
        ['210301', 'Acreedores Varios', 2, 'ACREEDORA'],
        ['2104', 'IVA - Débito Fiscal', 2, 'ACREEDORA'],
        ['2105', 'IVA por Pagar', 2, 'ACREEDORA'],
        ['2106', 'Retención de IVA por Pagar (1%)', 2, 'ACREEDORA'],
        ['2201', 'Préstamos Bancarios a Largo Plazo', 2, 'ACREEDORA'],
        ['3101', 'Capital Social', 3, 'ACREEDORA'],
        ['3102', 'Reserva Legal', 3, 'ACREEDORA'],
        ['3103', 'Utilidades Retenidas / Acumuladas', 3, 'ACREEDORA'],
        ['4101', 'Costo de Ventas', 4, 'DEUDORA'],
        ['4102', 'Compras', 4, 'DEUDORA'],
        ['4103', 'Gastos sobre Compras', 4, 'DEUDORA'],
        ['4104', 'Devoluciones y Rebajas sobre Compras', 4, 'ACREEDORA'],
        ['4201', 'Gastos de Administración', 4, 'DEUDORA'],
        ['420101', 'Chequera', 4, 'DEUDORA'],
        ['4202', 'Gastos de Venta', 4, 'DEUDORA'],
        ['420201', 'Papelería y Útiles', 4, 'DEUDORA'],
        ['4203', 'Gastos Financieros', 4, 'DEUDORA'],
        ['420301', 'Comisiones Bancarias', 4, 'DEUDORA'],
        ['4204', 'Sueldos y Salarios', 4, 'DEUDORA'],
        ['5101', 'Ventas', 5, 'ACREEDORA'],
        ['510102', 'Devolución sobre Venta', 5, 'DEUDORA'],
        ['5102', 'Ingresos Financieros', 5, 'ACREEDORA'],
        ['5103', 'Devoluciones y Rebajas sobre Ventas', 5, 'DEUDORA'],
        ['5201', 'Otros Ingresos Operativos', 5, 'ACREEDORA']
      ];

      for (let c of cuentas) {
        await wrapper.query(
          'INSERT OR IGNORE INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES (?, ?, ?, ?)',
          c
        );
      }
      console.log('✅ Catálogo de cuentas principales cargado en SQLite.');
    }

    // Limpieza de cuentas duplicadas en bases de datos SQLite existentes
    try {
      const [cCompras] = await wrapper.query(`SELECT id FROM catalogo_cuentas WHERE codigo = '4102'`);
      const [cVentas] = await wrapper.query(`SELECT id FROM catalogo_cuentas WHERE codigo = '5101'`);

      if (cCompras.length > 0) {
        const id4102 = cCompras[0].id;
        const [dupCompras] = await wrapper.query(`SELECT id FROM catalogo_cuentas WHERE codigo = '410101'`);
        if (dupCompras.length > 0) {
          const idsDup = dupCompras.map(x => x.id);
          await wrapper.query(`UPDATE detalle_asiento SET cuenta_id = ? WHERE cuenta_id IN (${idsDup.join(',')})`, [id4102]);
          await wrapper.query(`DELETE FROM catalogo_cuentas WHERE id IN (${idsDup.join(',')})`);
        }
      }

      if (cVentas.length > 0) {
        const id5101 = cVentas[0].id;
        const [dupVentas] = await wrapper.query(`SELECT id FROM catalogo_cuentas WHERE codigo IN ('510101', '5104')`);
        if (dupVentas.length > 0) {
          const idsDup = dupVentas.map(x => x.id);
          await wrapper.query(`UPDATE detalle_asiento SET cuenta_id = ? WHERE cuenta_id IN (${idsDup.join(',')})`, [id5101]);
          await wrapper.query(`DELETE FROM catalogo_cuentas WHERE id IN (${idsDup.join(',')})`);
        }
      }
      // Asegurar actualización de nombre de cuenta 1105 a Remanente de Crédito Fiscal (IVA a Favor)
      await wrapper.query(`UPDATE catalogo_cuentas SET nombre = 'Remanente de Crédito Fiscal (IVA a Favor)' WHERE codigo = '1105'`);
      await wrapper.query(`INSERT OR IGNORE INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES ('1105', 'Remanente de Crédito Fiscal (IVA a Favor)', 1, 'DEUDORA')`);
      await wrapper.query(`INSERT OR IGNORE INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES ('110501', 'Remanente de Crédito Fiscal (IVA a Favor)', 1, 'DEUDORA')`);
    } catch(e) {
      console.error('Nota en migración de cuentas:', e.message);
    }
  } catch (err) {
    console.error('Error al poblar catálogo SQLite:', err.message);
  }
})();

module.exports = wrapper;
