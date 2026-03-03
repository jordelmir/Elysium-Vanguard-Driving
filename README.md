# 🏎️ Elysium Vanguard Driving: Enterprise Mobility Platform

**Elysium Vanguard Driving** es una plataforma de movilidad premium de nivel empresarial, diseñada para ofrecer una experiencia de transporte fluida, inteligente y altamente escalable. Inspirada en gigantes como Uber e InDriver, esta aplicación integra tecnologías de vanguardia para garantizar baja latencia, resiliencia total y una interfaz de usuario cinematográfica.

---

## 🏛️ Los 4 Pilares de la Masterización

### 1. UI/UX Masterization (Visual Excellence)

* **Design System**: Modo oscuro refinado con efectos de **Glassmorphism** y jerarquía visual optimizada.
* **Fluidez Nativa**: Animaciones de alto rendimiento mediante `React Native Reanimated 3` y transiciones elásticas.
* **Android Native Stability**: Layout quirúrgicamente refactorizado para soportar eventos de sistema (teclado virtual) sin colapsar la UI, utilizando `KeyboardAvoidingView` y arquitecturas de capas (`Z-Index`).

### 2. Backend & Real-time Systems

* **Supabase Cloud**: Migración exitosa de Firebase a PostgreSQL para una gestión de datos relacional y escalable.
* **High-Frequency Tracking**: Localización en tiempo real con actualizaciones cada 2 segundos mediante WebSockets y Supabase Realtime.
* **Ride State Machine**: Gestión robusta del ciclo de vida del viaje (Solicitado -> Aceptado -> Iniciado -> Finalizado) con protección contra cambios de estado inválidos.

### 3. Core Business Logic & Algorithms

* **Matching Geoespacial**: Utilización de **PostGIS** para encontrar conductores cercanos en milisegundos mediante consultas espaciales de alta precisión.
* **Pricing Engine**: Motor de tarifas avanzado que soporta **Surge Pricing** (multiplicadores por demanda) y desglose de costos detallado.
* **ETA Prediction**: Algoritmos iniciales para el cálculo de tiempo estimado de llegada basados en proximidad real.

### 4. Resilience, Security & DevOps

* **Offline-First GPS**: Sistema de caché local que almacena puntos GPS durante pérdidas de señal y los sincroniza automáticamente al recuperar la conexión.
* **Security Hardening**: Autenticación vía JWT, Row Level Security (RLS) en base de datos y prevención de fraude en solicitudes.
* **Containerization**: Infraestructura lista para la nube con **Docker**, facilitando despliegues consistentes en entornos de producción.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | React Native (Expo) + Reanimated + Leaflet |
| **Backend** | Supabase (PostgreSQL 15 + PostGIS) |
| **Infraestructura** | Docker + GitHub Actions (CI/CD Ready) |
| **Localización** | Leaflet View + OSM (CartoDB DarkMatter) |
| **Real-time** | Supabase Realtime (WebSockets) |

---

## 📦 Estructura del Proyecto

```text
ElysiumVanguardDriving/
├── src/
│   ├── components/       # Componentes UI reutilizables (Search, BottomSheet)
│   ├── screens/          # Pantallas principales (MasterRiderDashboard)
│   ├── services/
│   │   ├── core/         # PricingEngine, Matchmaking
│   │   ├── realtime/     # LocationService, RideStateMachine
│   │   └── resilience/   # OfflineSync, Security
│   └── lib/              # Configuración de Clientes (Supabase)
├── supabase/
│   └── migrations/       # Esquemas y funciones SQL (PostGIS)
├── android/              # Configuración nativa de Android
├── Dockerfile            # Configuración para despliegue en contenedores
└── README.md             # Documentación principal
```

---

## 🚀 Despliegue y Ejecución

### Requisitos Previos

* Node.js 20+
* Supabase CLI
* React Native Development Environment (Android SDK)

### Pasos

1. **Instalar dependencias**:

    ```bash
    npm install
    ```

2. **Configurar Variables de Entorno**:
    Crea un archivo `.env` con tus credenciales de Supabase:

    ```env
    SUPABASE_URL=tu_url
    SUPABASE_ANON_KEY=tu_key
    ```

3. **Ejecutar en Android**:

    ```bash
    npx expo run:android
    ```

4. **Compilar APK**:

    ```bash
    cd android && ./gradlew assembleDebug
    ```

---

## 🏆 Entregables Disponibles en GitHub

* `ElysiumVanguardDriving_Enterprise_Master.apk`: Binario con arquitectura core completa.
* `ElysiumVanguardDriving_Android_Keyboard_Fixed.apk`: Versión con correcciones de UI para teclado Android.
* `supabase/migrations/`: Scripts SQL para replicar la infraestructura en cualquier proyecto de Supabase.

---

**Desarrollado con precisión técnica por el Equipo de Advanced Agentic Coding - Deepmind.**
