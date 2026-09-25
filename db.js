const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'sistema_contable',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Función de prueba opcional para verificar conexión
pool.getConnection()
  .then(connection => {
    console.log('⚡ Conexión exitosa a la base de datos MySQL (sistema_contable)');
    connection.release();
  })
  .catch(err => {
    console.warn('⚠️ Advertencia: No se pudo conectar a MySQL en este momento:', err.message);
    console.warn('Asegúrate de tener corriendo MySQL / XAMPP / SQLyog y de ejecutar schema.sql y data.sql.');
  });

module.exports = pool;
