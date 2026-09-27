const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de API REST Módulares
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/catalogo', require('./routes/catalogo.routes'));
app.use('/api/partidas', require('./routes/partidas.routes'));
app.use('/api/reportes', require('./routes/reportes.routes'));
app.use('/api/kardex', require('./routes/kardex.routes'));

// Endpoint de estado / salud del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    sistema: 'Sistema de Gestión Contable y Estados Financieros',
    timestamp: new Date().toISOString()
  });
});

// Redirección por defecto a dashboard.html para el modo aplicación de escritorio
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error general en servidor:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Ocurrió un error inesperado en el servidor.',
    error: err.message
  });
});

// Iniciar Servidor HTTP
const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Servidor Contable ejecutándose en: http://localhost:${PORT}`);
  console.log(`📊 Sistema de Gestión Contable y Estados Financieros`);
  console.log('====================================================');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`ℹ️ Servidor contable ya activo en http://localhost:${PORT}`);
  } else {
    console.error('❌ Error al iniciar servidor:', err.message);
  }
});
