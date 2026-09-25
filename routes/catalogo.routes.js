const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/catalogo - Obtener catálogo de cuentas completo
router.get('/', async (req, res) => {
  try {
    const [cuentas] = await db.query(
      `SELECT id, codigo, nombre, tipo, naturaleza 
       FROM catalogo_cuentas 
       ORDER BY codigo ASC`
    );
    res.json({ success: true, cuentas });
  } catch (error) {
    console.error('Error al obtener catálogo:', error);
    res.status(500).json({ success: false, message: 'Error al obtener catálogo de cuentas', error: error.message });
  }
});

// GET /api/catalogo/tipo/:tipo - Obtener cuentas filtradas por tipo (1: Activo, 2: Pasivo, etc.)
router.get('/tipo/:tipo', async (req, res) => {
  try {
    const tipo = parseInt(req.params.tipo, 10);
    const [cuentas] = await db.query(
      `SELECT id, codigo, nombre, tipo, naturaleza 
       FROM catalogo_cuentas 
       WHERE tipo = ? 
       ORDER BY codigo ASC`,
      [tipo]
    );
    res.json({ success: true, cuentas });
  } catch (error) {
    console.error('Error al obtener cuentas por tipo:', error);
    res.status(500).json({ success: false, message: 'Error al filtrar cuentas', error: error.message });
  }
});

// POST /api/catalogo - Registrar nueva cuenta (Admin)
router.post('/', async (req, res) => {
  try {
    const { codigo, nombre, tipo, naturaleza } = req.body;

    if (!codigo || !nombre || !tipo || !naturaleza) {
      return res.status(400).json({ success: false, message: 'Todos los campos (código, nombre, tipo, naturaleza) son obligatorios.' });
    }

    const [result] = await db.query(
      `INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES (?, ?, ?, ?)`,
      [codigo.trim(), nombre.trim(), parseInt(tipo, 10), naturaleza.toUpperCase()]
    );

    res.status(201).json({
      success: true,
      message: 'Cuenta creada exitosamente.',
      cuenta: { id: result.insertId, codigo, nombre, tipo, naturaleza }
    });
  } catch (error) {
    console.error('Error al crear cuenta:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'El código de cuenta ya existe en el catálogo.' });
    }
    res.status(500).json({ success: false, message: 'Error al guardar la cuenta contable.', error: error.message });
  }
});

module.exports = router;
