const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const dbName = process.env.DB_NAME || 'sistema_contable';

  console.log(`🔌 Conectando a MySQL en ${host}:${port} como ${user}...`);

  let connection;
  try {
    // Conectar al servidor sin seleccionar base de datos inicialmente
    connection = await mysql.createConnection({
      host,
      user,
      password,
      port,
      multipleStatements: true
    });

    console.log('✅ Conexión establecida con el servidor MySQL.');

    // 1. Ejecutar schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Leyendo ${schemaPath}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log(`🚀 Ejecutando schema.sql (creación de base de datos y tablas)...`);
    await connection.query(schemaSql);
    console.log('✅ Base de datos y tablas creadas exitosamente.');

    // 2. Ejecutar data.sql
    const dataPath = path.join(__dirname, 'data.sql');
    console.log(`📄 Leyendo ${dataPath}...`);
    const dataSql = fs.readFileSync(dataPath, 'utf8');

    console.log(`🚀 Ejecutando data.sql (inserción de roles, usuarios y catálogo de cuentas)...`);
    await connection.query(dataSql);
    console.log('✅ Datos iniciales cargados exitosamente.');

    // 3. Verificación
    await connection.changeUser({ database: dbName });
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n📋 Tablas en '${dbName}':`);
    tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

    const [cuentas] = await connection.query('SELECT COUNT(*) AS total FROM catalogo_cuentas');
    const [usuarios] = await connection.query('SELECT COUNT(*) AS total FROM usuarios');
    const [roles] = await connection.query('SELECT COUNT(*) AS total FROM roles');

    console.log(`\n📊 Registros cargados:`);
    console.log(`   - Roles: ${roles[0].total}`);
    console.log(`   - Usuarios: ${usuarios[0].total}`);
    console.log(`   - Cuentas Contables: ${cuentas[0].total}`);
    console.log('\n🎉 ¡Base de datos inicializada y lista para usar!');

  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
