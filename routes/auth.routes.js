const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Por favor ingresa correo y contraseña.' });
    }

    const [rows] = await db.query(
      `SELECT u.id, u.nombre, u.email, u.password, u.rol_id, r.nombre AS rol_nombre 
       FROM usuarios u 
       INNER JOIN roles r ON u.rol_id = r.id 
       WHERE u.email = ?`,
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas. Correo no registrado.' });
    }

    const usuario = rows[0];

    // Verificación simple de contraseña
    if (usuario.password !== password) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas. Contraseña incorrecta.' });
    }

    // Retornar información del usuario (sin devolver el password)
    const { password: _, ...usuarioSinPassword } = usuario;

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor al autenticar.', error: error.message });
  }
});

module.exports = router;
