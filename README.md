<div align="center">

# 🤖 SIMLA Automatización
### Plataforma de Evaluación de Calidad para Call Centers con IA

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Groq AI](https://img.shields.io/badge/Groq-AI-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com)
[![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)](/)

<br/>

> **Automatiza la evaluación de calidad de gestores de call center** usando Inteligencia Artificial.  
> Conecta con la API de Simla CRM, analiza conversaciones en tiempo real y genera boletas de calidad en Excel.

</div>

---

## ✨ Características Principales

| Característica | Descripción |
|---|---|
| 🧠 **Evaluación con IA** | Análisis de chats con Groq LLM usando una rúbrica de 100 puntos |
| 📊 **Dashboard de Métricas** | Radar charts y barras con promedios por sección |
| 📷 **OCR de Imágenes** | Extracción de texto de imágenes enviadas por gestores (Tesseract.js) |
| 📝 **Anotaciones de Supervisor** | Notas editables persistidas por chat |
| 📁 **Exportación Excel** | Boletas de calidad con colores, totales y KPIs por criterio |
| 🔍 **Modal de Chat** | Vista del historial completo con badges de evaluación por mensaje |
| 📅 **Filtro por Fechas** | Rango de hasta 3 días para cargar chats de un gestor |
| 🌙 **Dark Mode** | Tema oscuro / claro con toggle |

---

## 🏆 Rúbrica de Evaluación (100 pts)

```
📋 Cumplimiento de Scripts     ──── 20 pts
   ├─ Saludo adecuado                10 pts
   └─ Despedida completa             10 pts

📞 Cumplimiento de Protocolo   ──── 60 pts
   ├─ Personaliza al cliente          5 pts
   ├─ Tiempos de respuesta            5 pts
   ├─ Manejo de espera                7 pts
   ├─ Valida datos                    5 pts
   ├─ Toma de pedido                  9 pts
   ├─ Ofrece adicionales              8 pts
   ├─ Confirma orden                  7 pts
   ├─ Link de pago                    7 pts
   ├─ Pregunta ayuda adicional        4 pts
   └─ Sin silencios prolongados       3 pts

⭐ Calidad de la Atención       ──── 10 pts
   ├─ Dominio del producto            3 pts
   ├─ Redacción clara                 3 pts
   └─ Empatía y cortesía             4 pts

📂 Cumplimiento de Registro    ──── 10 pts
   ├─ Confirma datos en chat          5 pts
   └─ Coloca etiquetas                5 pts
```

---

## 🚀 Instalación

### Prerrequisitos
- Node.js ≥ 18
- Cuenta en [Groq](https://console.groq.com) (API key gratuita)
- Acceso a la API de Simla CRM

### 1. Clonar el repositorio
```bash
git clone https://github.com/David815-hue/AutomatizacionSIMLA.git
cd AutomatizacionSIMLA
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```env
VITE_SIMLA_API_KEY=tu_api_key_de_simla
VITE_SIMLA_ACCOUNT=tu_cuenta.simla.com
VITE_GROQ_API_KEY=tu_api_key_de_groq
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

### 5. Build de producción
```bash
npm run build
```

---

## 🛠️ Stack Tecnológico

<div align="center">

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19 + Vite 7 |
| **UI Animations** | Framer Motion |
| **Charts** | Recharts (Radar + Bar) |
| **IA / LLM** | Groq API (LLaMA 3) |
| **OCR** | Tesseract.js |
| **Excel** | ExcelJS + FileSaver |
| **Data Fetching** | TanStack React Query |
| **Icons** | Lucide React |
| **Date Filtering** | react-date-range + date-fns |

</div>

---

## 📱 Vistas de la Aplicación

### 🏠 Pantalla Principal
Selección de credenciales de cuenta Simla CRM.

### 💬 Vista de Chats
Listado de conversaciones del gestor seleccionado con filtros por fecha.

### 📊 Panel de Evaluación
- **Modo Random**: Selecciona N chats aleatorios del gestor y los evalúa en batch
- **Modo Manual IDs**: Pega IDs específicos de diálogos para evaluar
- Tabla de resultados con scores por sección
- Radar chart comparativo entre muestras
- Exportación a Excel con colores semafóricos (🟢 ≥90% / 🟡 ≥70% / 🔴 <70%)

### 🔍 Modal de Chat
- Visualización de la conversación completa con burbujas
- **Smart Badges**: Badges de evaluación anclados al último mensaje del agente evaluado
- **Líneas de agrupación**: Conectores visuales para bloques de mensajes evaluados juntos
- Acordeón desplegable con:
  - 💡 Recomendación de la IA
  - 🔍 Buscador de mensajes
  - ✏️ Nota editable del supervisor (guardado automático)

---

## 🔒 Seguridad

- Las API keys se manejan **solo en el cliente** vía variables de entorno `VITE_*`
- No hay backend propio; todas las llamadas van directamente a Simla CRM y Groq APIs
- Las notas del supervisor se persisten en `localStorage` (no se envían a ningún servidor)

---

## 📄 Licencia

Uso privado — © 2025 Punto Farma Honduras. Todos los derechos reservados.

---

<div align="center">

Hecho con ❤️ para el equipo de Call Center de **Punto Farma Honduras**

</div>
