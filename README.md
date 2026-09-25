# Sistema de Gestión Contable, Kardex y Estados Financieros V2

Sistema web automatizado para la gestión del ciclo contable completo: registro de partidas con validación de partida doble y columna parcial, tarjeta de control de inventarios Kardex (método Promedio Ponderado), mayorización en tiempo real en cuentas T y emisión dinámica de Estados Financieros (Balance General y Estado de Resultados Analítico en Formato Oficial de 4 Columnas con alternador Con/Sin Inventarios).

---

## 🛠️ Stack Tecnológico y Requisitos

- **Backend:** Node.js (v18 o superior) con Express.js
- **Frontend:** HTML5, CSS3 (Bootstrap 5, Bootstrap Icons) y JavaScript nativo (`Fetch API`)
- **Base de Datos:** MySQL / MariaDB (Driver `mysql2/promise`)
- **Herramienta recomendada:** XAMPP, WAMP, MySQL Workbench, SQLyog o phpMyAdmin
- **Control de Versiones:** Git & GitHub

---

## 👥 Credenciales de Acceso

| Rol | Usuario / Correo | Contraseña | Alcance |
|---|---|---|---|
| **Administrador** | `admin@contable.com` | `admin123` | Control total, catálogo de cuentas, auditoría y reinicio. |
| **Contador** | `contador@contable.com` | `conta123` | Libro Diario, Kardex, Libro Mayor y Estados Financieros. |

---

## 🚀 Guía Rápida de Instalación (Para Compañeros de Equipo)

### Paso 1: Clonar o Descargar el Proyecto
```bash
git clone https://github.com/mdz-f/Sistema_Contable.git
cd Sistema_Contable
```

### Paso 2: Importar la Base de Datos en MySQL (1 solo archivo)
1. Inicia **MySQL** en tu computadora (por ejemplo, dando **Start** a MySQL en el panel de **XAMPP**).
2. Abre tu gestor favorito (**phpMyAdmin**, **SQLyog**, **HeidiSQL** o **MySQL Workbench**).
3. Importa o ejecuta el script unificado:
   📁 **`database/sistema_contable_completo.sql`**
   *(Este script crea la base de datos `sistema_contable`, todas sus tablas, roles, usuarios y el catálogo completo de cuentas de El Salvador).*

### Paso 3: Instalar Dependencias de Node.js
En la terminal de la carpeta del proyecto, ejecuta:
```bash
npm install
```

### Paso 4: Configurar Variables de Entorno (Opcional)
Si tu MySQL de XAMPP no tiene contraseña (lo normal por defecto), no necesitas configurar nada.
Si tu MySQL tiene contraseña, crea un archivo `.env` en la raíz (puedes guiarte con `.env.example`):
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_aqui
DB_NAME=sistema_contable
DB_PORT=3306
```

### Paso 5: Iniciar el Sistema
```bash
node server.js
```
o también:
```bash
npm start
```
Abre en tu navegador: **`http://localhost:3000`**

---

## 📋 Módulos Principales del Sistema

### 1. 📦 Kardex de Inventario (`kardex.html`)
- Control de existencias bajo el método de **Costo Promedio Ponderado**.
- Movimientos admitidos:
  - `INICIAL`: Inventario inicial de mercaderías.
  - `ENTRADA`: Compras de mercadería.
  - `SALIDA`: Salidas de mercadería a precio de costo.
  - `DEV_COMPRA`: Devoluciones sobre compra.
  - `DEV_VENTA`: Devoluciones sobre venta.
- Cálculo automático de saldo en unidades, costo promedio unitario y valor monetario en bodega.

### 2. 📖 Libro Diario y Asistente de Ajustes (`diario.html`)
- Registro de asientos con columna **Parcial**, **Debe** y **Haber**.
- Validación estricta de partida doble: $\sum \text{Debe} = \sum \text{Haber}$.
- Botones para borrar partidas individuales y cargar datos de demostración.
- **Asistente de Ajustes de Inventarios:** Genera automáticamente los dos asientos de ajuste:
  - *Ajuste 1:* Traspaso de Inventario Inicial a Compras (`Compras` al Debe / `Inventarios` al Haber).
  - *Ajuste 2:* Registro de Inventario Final Físico deduciéndolo de Compras (`Inventarios` al Debe / `Compras` al Haber).

### 3. 📑 Libro Mayor en Cuentas T (`mayor.html`)
- Mayorización en tiempo real agrupada por cuenta con visualización de débitos, créditos y saldo según su naturaleza (Deudora o Acreedora).

### 4. 📊 Estados Financieros Dinámicos (`estados.html`)
- **Estado de Resultados Analítico (4 Columnas):**
  - Formato oficial que desglosa:
    1. Ventas Totales - Devoluciones s/ Ventas = **Ventas Netas**
    2. Compras + Gastos s/ Compras = **Compras Totales** - Devoluciones s/ Compras = **Compras Netas**
    3. Inventario Inicial + Compras Netas = **Mercancía Disponible** - Inventario Final = **Costo de Venta**
    4. Ventas Netas - Costo de Venta = **Utilidad Bruta**
    5. Gastos de Operación (Gastos de Venta, Administración, Financieros)
    6. **Utilidad del Ejercicio**
- **Botón Con Inventarios vs Sin Inventarios:**
  - *Con Inventarios:* El Estado de Resultados calcula automáticamente el Costo de Venta desde el Kardex sin generar asientos de ajuste que alteren el Libro Mayor.
  - *Sin Inventarios:* Genera automáticamente los asientos de ajuste en el Libro Diario y se reflejan en el Libro Mayor.
- **Balance General:** Ecuación contable verificada al centavo:
  $$\text{Activo} = \text{Pasivo} + \text{Capital Contable} + \text{Utilidad del Ejercicio}$$

---

## 📁 Estructura del Repositorio

```
SistemaCont_V2/
├── database/
│   ├── sistema_contable_completo.sql  # Script SQL "todo en uno" (Tablas + Catálogo + Datos)
│   ├── schema.sql                     # Creación de tablas
│   └── data.sql                       # Catálogo de cuentas y usuarios
├── public/                            # Interfaz Web
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── auth.js                    # Sesión y login
│   │   ├── diario.js                  # Libro Diario y asistente de ajustes
│   │   ├── mayor.js                   # Mayorización y cuentas T
│   │   ├── kardex.js                  # Lógica del Kardex
│   │   └── estados.js                 # 4 Columnas y Balance General
│   ├── index.html                     # Login
│   ├── dashboard.html                 # Panel Principal
│   ├── diario.html                    # Libro Diario
│   ├── mayor.html                     # Libro Mayor
│   ├── kardex.html                    # Kardex de Inventarios
│   └── estados.html                   # Estados Financieros
├── routes/
│   ├── auth.routes.js
│   ├── catalogo.routes.js
│   ├── partidas.routes.js
│   ├── kardex.routes.js
│   └── reportes.routes.js
├── db.js                              # Conexión MySQL con mysql2
├── server.js                          # Servidor Node.js Express
├── .env.example                       # Ejemplo de variables de entorno
├── .gitignore                         # Archivos ignorados por Git
└── README.md                          # Documentación del proyecto
```

