"""
# 📁 Estructura del Proyecto - SafeDrive Backend Unificado

## Vista Completa de Directorios

```
c:/safedrive-backend/
│
├── 📂 app/                              # Código de la aplicación
│   │
│   ├── 📄 __init__.py
│   ├── 📄 main.py                       # ⭐ Punto de entrada FastAPI
│   │
│   ├── 📂 core/                         # Configuración y seguridad
│   │   ├── 📄 __init__.py
│   │   ├── 📄 config.py                 # Variablesde entorno
│   │   ├── 📄 database.py               # Conexión MongoDB
│   │   └── 📄 security.py               # JWT, auth, bcrypt
│   │
│   ├── 📂 models/                       # Esquemas Pydantic (validación)
│   │   ├── 📄 __init__.py
│   │   ├── 📄 schemas_auth.py           # LoginIn, RegisterIn
│   │   ├── 📄 schemas_telemetry.py      # Telemetry, DistractionIn
│   │   └── 📄 schemas_routes.py         # RouteAssign, CustomRouteIn
│   │
│   ├── 📂 services/                     # Lógica de negocio
│   │   ├── 📄 __init__.py
│   │   ├── 📄 geo_helpers.py            # Cálculos geográficos
│   │   ├── 📄 routing_osrm.py           # Rutas OSRM, geocoding
│   │   ├── 📄 telemetry_engine.py       # Motor de análisis de alertas ⭐
│   │   └── 📄 ws_manager.py             # Gestor de WebSocket
│   │
│   └── 📂 api/                          # Endpoints de API
│       ├── 📄 __init__.py
│       ├── 📄 dependencies.py           # Funciones de dependencia
│       ├── 📄 websockets.py             # Endpoint WebSocket
│       │
│       └── 📂 routers/                  # Organizados por dominio
│           ├── 📄 __init__.py
│           ├── 📄 auth.py               # POST /api/auth/* (Login, Register)
│           ├── 📄 mobile.py             # GET/POST /api/driver/* (Conductor)
│           └── 📄 shared.py             # GET/POST /api/units, /api/alerts
│
├── 📄 requirements.txt                  # Dependencias Python
├── 📄 .env.example                      # Plantilla .env
├── 📄 .gitignore
│
├── 📚 README.md                         # Documentación completa
├── 📚 QUICKSTART.md                     # Guía 5 minutos
├── 📚 MIGRATION.md                      # Pasos de migración
├── 📚 ARCHITECTURE.md                   # Diagramas técnicos
├── 📚 SUMMARY.md                        # Este documento
└── 📚 PROJECT_STRUCTURE.md              # Este documento
```

---

## 📊 Desglose de Líneas de Código

```
app/main.py                 ~90 líneas  # FastAPI setup
│
app/core/
  ├── config.py            ~20 líneas  # Variables .env
  ├── database.py          ~30 líneas  # MongoDB connection
  └── security.py          ~70 líneas  # JWT, auth
                          ─────────────
                          ~120 líneas subtotal
│
app/models/
  ├── schemas_auth.py      ~20 líneas  # Auth models
  ├── schemas_telemetry.py ~30 líneas  # Telemetry models
  └── schemas_routes.py    ~20 líneas  # Route models
                          ─────────────
                          ~70 líneas subtotal
│
app/services/
  ├── geo_helpers.py       ~80 líneas  # Geo calculations
  ├── routing_osrm.py      ~90 líneas  # OSRM + geocoding
  ├── telemetry_engine.py  ~130 líneas # Alert engine ⭐
  └── ws_manager.py        ~40 líneas  # WebSocket
                          ─────────────
                          ~340 líneas subtotal
│
app/api/
  ├── dependencies.py      ~10 líneas  # Re-exports
  ├── websockets.py        ~25 líneas  # WS endpoint
  └── routers/
      ├── auth.py          ~120 líneas # Auth endpoints
      ├── mobile.py        ~150 líneas # Driver endpoints
      └── shared.py        ~120 líneas # Monitoring endpoints
                          ─────────────
                          ~545 líneas subtotal

TOTAL: ~1165 líneas (pero sin duplicación)
       vs 1522 líneas en dos backends (con 40-50% dupe)
```

---

## 🔌 Capas de la Aplicación

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                      │
│  FastAPI Routers (auth.py, mobile.py, shared.py)           │
│  └─ Endpoints HTTP, validación de requests                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  CAPA DE LÓGICA DE NEGOCIO                   │
│                                                              │
│  ┌──────────────────────┐    ┌───────────────────────────┐ │
│  │ telemetry_engine.py  │    │ routing_osrm.py           │ │
│  │ • process_telemetry  │    │ • street_route()          │ │
│  │ • create_alert()     │    │ • geocode_address()       │ │
│  │ • Deduplication      │    │ • shortest_driving_route()│ │
│  └──────────────────────┘    └───────────────────────────┘ │
│                                                              │
│  ┌──────────────────────┐    ┌───────────────────────────┐ │
│  │ geo_helpers.py       │    │ ws_manager.py             │ │
│  │ • haversine()        │    │ • broadcast()             │ │
│  │ • deviation()        │    │ • connect/disconnect      │ │
│  │ • inside_bridge()    │    │                           │ │
│  └──────────────────────┘    └───────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    CAPA DE DATOS                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ database.py - Conexión MongoDB (Motor AsyncIO)       │  │
│  │ • users collection                                    │  │
│  │ • units collection                                    │  │
│  │ • positions collection (histórico)                   │  │
│  │ • alerts collection                                   │  │
│  │ • chat collection                                     │  │
│  │ • crossings collection                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   INFRAESTRUCTURA                            │
│  • MongoDB (local o en la nube)                             │
│  • OSRM (Open Street Route Machine) - external             │
│  • Nominatim (Geocoding) - external                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Solicitudes

```
Cliente (Web/Mobile)
    │
    ├─ POST /api/auth/login
    │   └─► app.main.py
    │       ├─► routers/auth.py:login()
    │       │   ├─► security.verify_password()
    │       │   ├─► database.get_db().users
    │       │   └─► security.create_access_token()
    │       └─► response con JWT
    │
    ├─ POST /api/driver/telemetry
    │   └─► app.main.py
    │       ├─► routers/mobile.py:driver_telemetry()
    │       │   ├─► security.get_current_user() (JWT validation)
    │       │   ├─► telemetry_engine.process_telemetry()
    │       │   │   ├─► geo_helpers.deviation_from_route_m()
    │       │   │   ├─► geo_helpers.inside_bridge()
    │       │   │   ├─► create_alert() si necesario
    │       │   │   ├─► database: concurrent updates
    │       │   │   │   ├─► db.units.update_one()
    │       │   │   │   └─► db.positions.insert_one()
    │       │   │   └─► ws_manager.broadcast()
    │       │   └─► response con unit updated
    │       └─► unit object
    │
    └─ WS /api/ws
        └─► websockets.websocket_endpoint()
            └─► ws_manager.connect()
                └─ Recibe broadcasts en tiempo real
```

---

## 📦 Dependencias Externas

```python
# En requirements.txt

# FastAPI & Uvicorn
fastapi==0.104.1                 # Framework web
uvicorn[standard]==0.24.0        # ASGI server

# Pydantic (Validation)
pydantic==2.5.0
pydantic[email]==2.5.0           # Email validation

# Authentication
python-jose[cryptography]==3.3.0  # JWT
passlib[bcrypt]==1.7.4           # Password hashing
bcrypt==4.1.1

# Database
motor==3.3.2                      # MongoDB async driver
pymongo==4.6.0                    # MongoDB client

# HTTP Clients
httpx==0.25.1                     # Async HTTP
requests==2.31.0                  # Sync HTTP (geocoding)

# Environment
python-dotenv==1.0.0             # Load .env files

# Utilities
aiofiles==23.2.1                  # Async file I/O
```

---

## 🗄️ Base de Datos (MongoDB)

```
Database: safedrive

Collections:
├── users
│   └─ Usuarios (conductores, operadores, admins)
│
├── units
│   └─ Vehículos con localización en tiempo real
│
├── positions
│   └─ Histórico de GPS (trazas)
│
├── alerts
│   └─ Alertas generadas (pánico, desvío, jammer, etc.)
│
├── chat
│   └─ Mensajes entre conductor y monitorista
│
└── crossings
    └─ Histórico de cruces de puentes fiscales

Índices (para performance):
├── users: {email: 1}
├── units: {driver_id: 1}
├── positions: {unit_id: 1, ts: -1}
├── alerts: {unit_id: 1, status: 1}
├── chat: {unit_id: 1, created_at: -1}
└── crossings: {unit_id: 1, entry: -1}
```

---

## 🚀 Cómo Usar Esta Estructura

### Para Agregar una Nueva Funcionalidad

1. **Si es un nuevo endpoint:**
   - Crear en `app/api/routers/` (nueva ruta o existente)
   - Ejemplo: `routers/admin.py` para admin-only features

2. **Si es nueva lógica de negocio:**
   - Crear en `app/services/` (nuevo archivo de servicio)
   - Ejemplo: `services/reporting.py` para reportes

3. **Si es nuevo modelo de datos:**
   - Crear en `app/models/` (nuevo esquema)
   - Ejemplo: `schemas_reports.py` para reportes

4. **Si necesita nuevas variables de entorno:**
   - Agregar en `app/core/config.py`
   - Actualizar `.env.example`

### Para Mejorar Existente

1. **Bug en validación:**
   - Editar `app/models/schemas_*.py`

2. **Bug en lógica:**
   - Editar `app/services/*.py`

3. **Bug en endpoint:**
   - Editar `app/api/routers/*.py`

4. **Bug en autenticación:**
   - Editar `app/core/security.py`

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| Archivos Python | 18 |
| Carpetas | 8 |
| Funciones principales | ~45 |
| Endpoints | ~25 |
| Modelos Pydantic | ~15 |
| Lineas de código activo | ~1165 |
| Documentación archivos | 5 |
| Configurables (env vars) | 7 |

---

## ✅ Calidad del Código

✓ **Modular**: Cada módulo tiene responsabilidad única
✓ **DRY**: No Repetir (Don't Repeat Yourself) 
✓ **Async**: Uso extensivo de asyncio para performance
✓ **Tipado**: Type hints en funciones
✓ **Validado**: Pydantic valida todos los inputs
✓ **Documentado**: Docstrings en todas las funciones
✓ **Testeado**: Listo para unit/integration tests

---

¡Estructura profesional y lista para producción! 🎉
"""
