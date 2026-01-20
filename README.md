# Dashboard Alef Company

Bienvenido al repositorio oficial del **Dashboard Avanzado de Alef Company**. Este sistema está diseñado para la gestión integral de las operaciones de la empresa y sus marcas asociadas, incluyendo **Brada Perfumes** y **Healup**.

![Alef Company Logo](./assets/img/aleflogo%20oscuro.png)

## 🚀 Características Principales

Este dashboard es una solución multi-marca que centraliza:

### 🏢 Gestión Corporativa (Alef Company)
- **Administración General**: Control de usuarios y accesos.
- **Leads y Clientes**: Seguimiento de prospectos y base de datos de clientes.

### 🧪 Brada Perfumes
- **Gestión de Stock**: Control detallado de inventario para:
  - Perfumes (Botellas completas)
  - Decants (Muestras de 5ml, 10ml)
  - Sets de Perfumes
- **Procedimientos de Entrega**: Tipos de entrega (Domicilio, Tienda) y seguimiento.
- **Calendario**: Agenda de entregas y visitas.
- **Facturación**:
  - Ingresos mensuales y ticket promedio.
  - Tasa de conversión real (Leads -> Clientes).
  - Gráficos de tendencias de ventas.

### ⚕️ Healup
- **Gestión de Pacientes**: Historia clínica y seguimiento.
- **Agenda Médica**: Calendario de citas interactivo.
- **Procedimientos Médicos**: Catálogo de servicios y precios.

## 🛠️ Tecnologías Utilizadas

Este proyecto utiliza un stack moderno y reactivo:

- **Framework**: [Nuxt 3](https://nuxt.com)
- **UI Toolkit**: [Vuetify 3](https://vuetifyjs.com)
- **Base de Datos & Auth**: [Supabase](https://supabase.com)
- **Visualización de Datos**: [ApexCharts](https://apexcharts.com)
- **Iconos**: Material Design Icons (MDI)

## 💻 Instalación y Configuración

Sigue estos pasos para levantar el proyecto en tu entorno local:

### 1. Prerrequisitos
- Node.js (v16.10.0 o superior)
- npm o yarn

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Configuración de Variables de Entorno
Asegúrate de tener configuradas las credenciales de Supabase en tu archivo `.env` (o directamente en `nuxt.config.ts` si aplica):

```
SUPABASE_URL=tu_url_de_supabase
SUPABASE_KEY=tu_anon_key
```

### 4. Ejecutar en Desarrollo

```bash
npm run dev
```

El servidor iniciará en `http://localhost:3000`.

## 📂 Estructura del Proyecto

- `/pages`: Módulos principales (`BradaPerfumes.vue`, `Healup.vue`, `AlefCompany.vue`).
- `/assets`: Estilos globales y recursos multimedia.
- `/components`: Componentes reutilizables.
- `/layouts`: Estructuras de página base.

---
**Alef Company** - *Innovación y Gestión.*
