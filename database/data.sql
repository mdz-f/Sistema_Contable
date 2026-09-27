USE sistema_contable;

-- Roles Iniciales
INSERT INTO roles (id, nombre) VALUES
(1, 'Administrador'),
(2, 'Contador');

-- Usuarios Iniciales
INSERT INTO usuarios (id, nombre, email, password, rol_id) VALUES
(1, 'Administrador del Sistema', 'admin@contable.com', 'admin123', 1),
(2, 'Contador General', 'contador@contable.com', 'conta123', 2);

-- Catálogo de Cuentas Estándar
-- 1: Activos (Deudora)
-- 2: Pasivos (Acreedora)
-- 3: Capital Contable (Acreedora)
-- 4: Costos y Gastos (Deudora)
-- 5: Ingresos (Acreedora)
INSERT INTO catalogo_cuentas (codigo, nombre, tipo, naturaleza) VALUES
-- 1. ACTIVOS
('1101', 'Efectivo y Equivalentes de Efectivo', 1, 'DEUDORA'),
('110101', 'Caja', 1, 'DEUDORA'),
('110102', 'Bancos', 1, 'DEUDORA'),
('1102', 'Cuentas por Cobrar Comerciales', 1, 'DEUDORA'),
('110201', 'Clientes', 1, 'DEUDORA'),
('1103', 'Inventarios / Mercaderías', 1, 'DEUDORA'),
('1104', 'IVA - Crédito Fiscal', 1, 'DEUDORA'),
('1105', 'Remanente de Crédito Fiscal', 1, 'DEUDORA'),
('1106', 'Anticipo a Cuenta de IVA (Percepción 1%)', 1, 'DEUDORA'),
('1107', 'Gastos Pagados por Anticipado', 1, 'DEUDORA'),
('110701', 'Papelería y Útiles', 1, 'DEUDORA'),
('110702', 'Alquiler', 1, 'DEUDORA'),
('110703', 'Otros Gastos', 1, 'DEUDORA'),
('1108', 'Seguros Pagados por Anticipado', 1, 'DEUDORA'),
('1109', 'Alquileres Pagados por Anticipado', 1, 'DEUDORA'),
('1201', 'Propiedad, Planta y Equipo', 1, 'DEUDORA'),
('120101', 'Edificios', 1, 'DEUDORA'),
('120103', 'Equipo de Cómputo', 1, 'DEUDORA'),
('1202', 'Mobiliario y Equipo de Oficina', 1, 'DEUDORA'),
('1203', 'Equipo de Transporte', 1, 'DEUDORA'),

-- 2. PASIVOS
('2101', 'Cuentas por Pagar Comerciales', 2, 'ACREEDORA'),
('210101', 'Proveedores', 2, 'ACREEDORA'),
('2102', 'Préstamos Bancarios a Corto Plazo', 2, 'ACREEDORA'),
('2103', 'Impuestos y Retenciones por Pagar', 2, 'ACREEDORA'),
('210301', 'Acreedores Varios', 2, 'ACREEDORA'),
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
('410101', 'Compras', 4, 'DEUDORA'),
('410102', 'Devolución sobre Compra', 4, 'ACREEDORA'),
('4102', 'Compras', 4, 'DEUDORA'),
('4103', 'Gastos sobre Compras', 4, 'DEUDORA'),
('4104', 'Devoluciones y Rebajas sobre Compras', 4, 'ACREEDORA'),
('4201', 'Gastos de Administración', 4, 'DEUDORA'),
('420101', 'Chequera', 4, 'DEUDORA'),
('4202', 'Gastos de Venta', 4, 'DEUDORA'),
('420201', 'Papelería y Útiles', 4, 'DEUDORA'),
('4203', 'Gastos Financieros', 4, 'DEUDORA'),
('420301', 'Comisiones Bancarias', 4, 'DEUDORA'),
('4204', 'Sueldos y Salarios', 4, 'DEUDORA'),

-- 5. INGRESOS
('5101', 'Ventas', 5, 'ACREEDORA'),
('510101', 'Ventas', 5, 'ACREEDORA'),
('510102', 'Devolución sobre Venta', 5, 'DEUDORA'),
('5102', 'Ingresos Financieros', 5, 'ACREEDORA'),
('5103', 'Devoluciones y Rebajas sobre Ventas', 5, 'DEUDORA'),
('5104', 'Ingresos por Ventas', 5, 'ACREEDORA'),
('5201', 'Otros Ingresos Operativos', 5, 'ACREEDORA');
