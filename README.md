# Sistema de Gestión Contable, Kardex y Estados Financieros

Sistema de escritorio automatizado para la gestión del ciclo contable completo. Permite la administración de transacciones mediante partidas de diario con validación estricta de partida doble, tarjetas de inventario Kardex bajo el método Promedio Ponderado, mayorización en tiempo real en cuentas T y generación de Estados Financieros (Balance General y Estado de Resultados Analítico en Formato Oficial de 4 Columnas).

---

## Stack Tecnológico y Arquitectura

- Aplicación de Escritorio: Electron v34
- Backend Interno: Node.js con Express.js
- Base de Datos Local: SQLite3 (mediante el motor de alto rendimiento better-sqlite3 con modo WAL activo)
- Frontend: HTML5, CSS3 (Bootstrap 5, Bootstrap Icons) y JavaScript Vanilla (Fetch API)
- Distribución: electron-builder (Generación de ejecutable Portable, Instalador MSI, Instalador Setup NSIS y Carpeta desempaquetada win-unpacked)

La base de datos SQLite se genera automáticamente en la primera ejecución dentro del directorio local del usuario (`%APPDATA%`), por lo que no se requiere instalar servidores externos como XAMPP, WAMP o MySQL.

---

## Credenciales de Acceso

| Rol | Usuario / Correo | Contraseña | Alcance |
|---|---|---|---|
| Administrador | admin@contable.com | admin123 | Control total, catálogo de cuentas, auditoría y gestión del sistema. |
| Contador | contador@contable.com | conta123 | Libro Diario, Kardex, Libro Mayor y Estados Financieros. |

---

## Opciones de Instalación y Distribución

Existen distintas alternativas para ejecutar y compartir la aplicación con otros usuarios o compañeros de equipo:

### Opción 1: Ejecutable Portátil (Recomendado para pruebas rápidas)
Ubicación: `dist/Sistema Contable 1.0.0.exe`
- Es un ejecutable independiente de un solo archivo.
- No requiere instalación ni permisos de administrador.
- Basta con enviar el archivo `.exe` al usuario para que lo ejecute directamente.

### Opción 2: Carpeta Comprimida (win-unpacked)
Ubicación: `dist/win-unpacked/`
- Se puede comprimir la carpeta `win-unpacked` en formato `.zip` o `.rar` y compartirla.
- El usuario solo debe descomprimir la carpeta y hacer doble clic sobre `Sistema Contable.exe`.

### Opción 3: Instalador MSI / Setup
Ubicación: `dist/Sistema Contable 1.0.0.msi` o `dist/Sistema Contable Setup 1.0.0.exe`
- Instalador corporativo estándar de Windows.
- Instala la aplicación en el menú de inicio y crea accesos directos en el sistema.

---

## Guía de Desarrollo e Instalación desde Código Fuente

Si deseas modificar el código o compilar tus propios ejecutables, sigue estos pasos:

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/mdz-f/Sistema_Contable.git
cd Sistema_Contable
```

### Paso 2: Instalar Dependencias
```bash
npm install
```

### Paso 3: Inicializar Base de Datos (Opcional en desarrollo)
```bash
npm run init-db
```
Nota: Si deseas sembrar datos de prueba iniciales, puedes ejecutar:
```bash
npm run seed
```

### Paso 4: Ejecutar en Modo Desarrollo
Para iniciar la aplicación de escritorio con Electron:
```bash
npm run electron
```

### Paso 5: Generar Paquetes de Distribución (Dist)
Para generar los ejecutables y carpetas de distribución (`dist/`):
```bash
npm run dist
```

---

## Módulos Principales del Sistema

### 1. Kardex de Inventarios (`kardex.html`)
- Control de existencias bajo el método de Costo Promedio Ponderado.
- Tipos de movimientos registrados:
  - INICIAL: Inventario inicial de mercaderías.
  - ENTRADA: Compras de mercadería.
  - SALIDA: Venta o salida de mercadería a precio de costo (requiere obligatoriamente especificar el precio unitario).
  - DEV_COMPRA: Devoluciones sobre compra.
  - DEV_VENTA: Devoluciones sobre venta.
- Recálculo automático de saldos en unidades, costo promedio unitario y valor total monetario en bodega.

### 2. Libro Diario y Asistente de Ajustes (`diario.html`)
- Registro de asientos contables con desglose en columna Parcial, Debe y Haber.
- Validación de partida doble en tiempo real (Suma del Debe = Suma del Haber).
- Buscador interactivo de partidas con coincidencia por número exacto de partida o descripción.
- Funcionalidad para editar y eliminar partidas registradas con actualización en cascada.
- Asistente de Ajustes de Inventarios:
  - Ajuste 1: Traspaso de Inventario Inicial a Compras.
  - Ajuste 2: Registro de Inventario Final Físico deduciéndolo de Compras.

### 3. Libro Mayor en Cuentas T (`mayor.html`)
- Mayorización dinámica agrupada por código de cuenta.
- Visualización de cargos, abonos y saldo neto según la naturaleza de la cuenta (Deudora o Acreedora).

### 4. Estados Financieros Dinámicos (`estados.html`)
- Estado de Resultados Analítico (Formato Oficial de 4 Columnas):
  - Desglose de Ventas Totales, Ventas Netas, Compras Totales, Compras Netas, Mercadería Disponible, Costo de Venta, Utilidad Bruta y Utilidad del Ejercicio.
  - Modo Con Inventarios vs Sin Inventarios para alternar entre lectura directa del Kardex o integración mediante asientos de ajuste.
- Balance General:
  - Verificación matemática de la ecuación contable: Activo = Pasivo + Capital Contable + Utilidad del Ejercicio.
- Exportación de reportes a formatos Excel y PDF.

---

## Estructura del Proyecto

```
Sistema_Contable/
├── database/
│   ├── init-db.js                     # Script de inicialización SQLite
│   ├── seed-ciclo-completo.js          # Datos de prueba para demostración
│   ├── schema.sql                     # Estructura de tablas
│   └── data.sql                       # Catálogo de cuentas inicial
├── public/                            # Interfaz de usuario (HTML/CSS/JS)
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── auth.js                    # Autenticación y control de sesión
│   │   ├── diario.js                  # Lógica del Libro Diario
│   │   ├── mayor.js                   # Lógica del Libro Mayor
│   │   ├── kardex.js                  # Lógica del Kardex
│   │   └── estados.js                 # Lógica de Estados Financieros
│   ├── index.html                     # Pantalla de inicio de sesión
│   ├── dashboard.html                 # Panel principal
│   ├── diario.html                    # Módulo Libro Diario
│   ├── mayor.html                     # Módulo Libro Mayor
│   ├── kardex.html                    # Módulo Kardex
│   └── estados.html                   # Módulo Estados Financieros
├── routes/                            # Rutas API de Express
│   ├── auth.routes.js
│   ├── catalogo.routes.js
│   ├── partidas.routes.js
│   ├── kardex.routes.js
│   └── reportes.routes.js
├── media/                             # Recursos gráficos (iconos e imágenes)
├── db.js                              # Configuración y conexión SQLite
├── main.js                            # Proceso principal de Electron
├── server.js                          # Servidor Express interno
├── package.json                       # Configuración y dependencias del proyecto
├── .gitignore                         # Reglas de exclusión para Git
└── README.md                          # Documentación oficial del proyecto
```
