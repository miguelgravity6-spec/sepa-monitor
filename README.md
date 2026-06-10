# SEPA Monitor 🏭

Sistema de Monitoreo y Control del Separador Industrial — Dashboard operacional en tiempo real.

## Características

- 📊 **Dashboard** con KPIs en tiempo real (velocidad, temperatura, anomalías)
- 🔄 **Rondas de control** horarias con checklist completo
- 📏 **Mediciones en terreno** (vibración, temperatura, velocidad, etc.)
- 📄 **Generación de reportes** de turno listos para copiar/enviar
- 🏭 **Control de despacho** con visualización de silos
- ⛔ **Parada de emergencia** con registro de motivo
- 🔥 **Firebase Realtime Database** para persistencia en la nube

## Tecnologías

- HTML5 / CSS3 / JavaScript (Vanilla)
- Firebase Realtime Database
- Google Fonts (Inter, JetBrains Mono)

## Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/TioDerwin1213/sepa-monitor.git
cd sepa-monitor
```

### 2. Configurar Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa **Realtime Database** en modo de prueba
3. Registra una app web y copia la configuración
4. Edita `firebase-config.js` con tu configuración:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "123456789",
    appId: "TU_APP_ID"
};
```

### 3. Abrir la aplicación
Simplemente abre `index.html` en tu navegador o usa un servidor local:
```bash
npx serve .
```

## Estructura del Proyecto

```
sepa-monitor/
├── index.html          # Página principal
├── styles.css          # Estilos del dashboard
├── app.js              # Lógica de la aplicación
├── firebase-config.js  # Configuración de Firebase
├── README.md           # Este archivo
└── .gitignore          # Archivos excluidos
```

## Operadores

| Operador | Turno  | Responsabilidad |
|----------|--------|-----------------|
| Hugo     | Día ☀️ | Verificar equipo, enviar correo con velocidad |
| Miguel   | Noche 🌙 | Replicar mismo control y reporte |

## Licencia

Uso interno — Proyecto operacional industrial.
