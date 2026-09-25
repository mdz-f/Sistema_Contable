-- ==============================================================================
-- SISTEMA CONTABLE V2 - SCRIPT COMPLETO DE BASE DE DATOS
-- Compatible con MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+ (XAMPP / WAMP / Workbench)
-- ==============================================================================

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

-- 1. Tabla de Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_roles FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Catálogo de Cuentas clasificado por dígito
-- 1: Activos (Deudora)
-- 2: Pasivos (Acreedora)
-- 3: Capital Contable (Acreedora)
-- 4: Costos y Gastos (Deudora)
-- 5: Ingresos (Acreedora)
CREATE TABLE catalogo_cuentas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    tipo INT NOT NULL COMMENT '1: Activo, 2: Pasivo, 3: Capital, 4: Costos/Gastos, 5: Ingresos',
    naturaleza ENUM('DEUDORA', 'ACREEDORA') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Encabezado de Partidas / Libro Diario
CREATE TABLE partidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_partida INT NOT NULL,
    fecha DATE NOT NULL,
    concepto TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Detalle de Asientos Contables
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

-- 6. Tarjeta de Control de Inventario / Kardex de Almacén
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

-- ==============================================================================
-- INSERCIÓN DE DATOS INICIALES Y CATÁLOGO OFICIAL
-- ==============================================================================

-- Roles Iniciales
INSERT INTO roles (id, nombre) VALUES
(1, 'Administrador'),
(2, 'Contador');

-- Usuarios Iniciales (Password en texto claro para fines educativos)
INSERT INTO usuarios (id, nombre, email, password, rol_id) VALUES
(1, 'Administrador del Sistema', 'admin@contable.com', 'admin123', 1),
(2, 'Contador General', 'contador@contable.com', 'conta123', 2);

-- Catálogo de Cuentas Completo
INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES
-- 1. ACTIVOS
('1101', 'Efectivo y Equivalentes de Efectivo', 1, 'DEUDORA'),
('1102', 'Cuentas por Cobrar Comerciales', 1, 'DEUDORA'),
('1103', 'Inventarios / Mercaderías', 1, 'DEUDORA'),
('1104', 'IVA - Crédito Fiscal', 1, 'DEUDORA'),
('1105', 'Remanente de Crédito Fiscal', 1, 'DEUDORA'),
('1106', 'Anticipo a Cuenta de IVA (Percepción 1%)', 1, 'DEUDORA'),
('1107', 'Gastos Pagados por Anticipado', 1, 'DEUDORA'),
('1108', 'Seguros Pagados por Anticipado', 1, 'DEUDORA'),
('1109', 'Alquileres Pagados por Anticipado', 1, 'DEUDORA'),
('1201', 'Propiedad, Planta y Equipo', 1, 'DEUDORA'),
('1202', 'Mobiliario y Equipo de Oficina', 1, 'DEUDORA'),
('1203', 'Equipo de Transporte', 1, 'DEUDORA'),

-- 2. PASIVOS
('2101', 'Cuentas por Pagar Comerciales', 2, 'ACREEDORA'),
('2102', 'Préstamos Bancarios a Corto Plazo', 2, 'ACREEDORA'),
('2103', 'Impuestos y Retenciones por Pagar', 2, 'ACREEDORA'),
('2104', 'IVA - Débito Fiscal', 2, 'ACREEDORA'),
('2105', 'IVA por Pagar', 2, 'ACREEDORA'),
('2106', 'Retención de IVA por Pagar (1%)', 2, 'ACREEDORA'),
('2201', 'Préstamos Bancarios a Largo Plazo', 2, 'ACREEDORA'),

-- 3. CAPITAL CONTABLE / PATRIMONIO
('3101', 'Capital Social', 3, 'ACREEDORA'),
('3102', 'Reserva Legal', 3, 'ACREEDORA'),
('3103', 'Utilidades Retenidas / Acumuladas', 3, 'ACREEDORA'),

-- 4. COSTOS Y GASTOS
('4101', 'Costo de Ventas', 4, 'DEUDORA'),
('4102', 'Compras', 4, 'DEUDORA'),
('4103', 'Gastos sobre Compras', 4, 'DEUDORA'),
('4104', 'Devoluciones y Rebajas sobre Compras', 4, 'ACREEDORA'),
('4201', 'Gastos de Administración', 4, 'DEUDORA'),
('4202', 'Gastos de Venta', 4, 'DEUDORA'),
('4203', 'Gastos Financieros', 4, 'DEUDORA'),
('4204', 'Sueldos y Salarios', 4, 'DEUDORA'),

-- 5. INGRESOS
('5101', 'Ventas', 5, 'ACREEDORA'),
('5102', 'Ingresos Financieros', 5, 'ACREEDORA'),
('5103', 'Devoluciones y Rebajas sobre Ventas', 5, 'DEUDORA'),
('5104', 'Ingresos por Ventas', 5, 'ACREEDORA'),
('5201', 'Otros Ingresos Operativos', 5, 'ACREEDORA');
