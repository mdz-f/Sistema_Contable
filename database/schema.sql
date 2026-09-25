CREATE DATABASE IF NOT EXISTS sistema_contable
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sistema_contable;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS detalle_asiento;
DROP TABLE IF EXISTS partidas;
DROP TABLE IF EXISTS kardex;
DROP TABLE IF EXISTS catalogo_cuentas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

-- Tabla de Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de Usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de Cuentas clasificado por primer dígito
CREATE TABLE catalogo_cuentas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    tipo INT NOT NULL COMMENT '1: Activo, 2: Pasivo, 3: Capital Contable, 4: Costos y Gastos, 5: Ingresos',
    naturaleza ENUM('DEUDORA', 'ACREEDORA') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Encabezado de Partidas / Libro Diario
CREATE TABLE partidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_partida INT NOT NULL,
    fecha DATE NOT NULL,
    concepto TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de Asientos Contables
CREATE TABLE detalle_asiento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    partida_id INT NOT NULL,
    cuenta_id INT NOT NULL,
    parcial DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    debe DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    haber DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_detalle_partida FOREIGN KEY (partida_id) REFERENCES partidas(id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_cuenta FOREIGN KEY (cuenta_id) REFERENCES catalogo_cuentas(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tarjeta de Control de Inventario / Kardex de Almacén
CREATE TABLE kardex (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto VARCHAR(150) NOT NULL DEFAULT 'Mercadería General',
    metodo ENUM('PROMEDIO', 'PEPS') NOT NULL DEFAULT 'PROMEDIO',
    fecha DATE NOT NULL,
    detalle VARCHAR(255) NOT NULL,
    tipo_movimiento ENUM('INICIAL', 'ENTRADA', 'SALIDA', 'DEV_COMPRA', 'DEV_VENTA') NOT NULL,
    cant_entrada DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cant_salida DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cant_saldo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    costo_unitario DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    costo_promedio DECIMAL(12,4) NOT NULL DEFAULT 0.00,
    debe DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    haber DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    saldo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
