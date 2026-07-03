"""
# SafeDrive GPS - Unified Backend

Backend centralizado para SafeDrive GPS que consolida la funcionalidad de web dashboard y aplicación móvil en una única API.

## ¿Por qué unificar?

✓ **Sin duplicación**: Un solo backend para ambas plataformas
✓ **Más eficiente**: Reducida complejidad operacional  
✓ **Más mantenible**: Código modular y reutilizable
✓ **Escalable**: Arquitectura lista para crecimiento

## Estructura del Proyecto

```
safedrive-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # Punto de entrada FastAPI
│   │
│   ├── core/
│   │   ├── config.py              # Variables de entorno
│   │   ├── database.py            # Conexión MongoDB (motor)
│   │   └── security.py            # JWT, auth, hashing
│   │
│   ├── models/
│   │   ├── schemas_auth.py        # LoginIn, RegisterIn, etc.
│   │   ├── schemas_telemetry.py   # Telemetry, Telemetry Batch
│   │   └── schemas_routes.py      # RouteAssign, CustomRouteIn
│   │
│   ├── services/
│   │   ├── geo_helpers.py         # haversine, deviation, interp_corridor
│   │   ├── routing_osrm.py        # street_route, geocoding
│   │   ├── telemetry_engine.py    # process_telemetry (cerebro analítico)
│   │   └── ws_manager.py          # ConnectionManager WebSocket
│   │
│   └── api/
│       ├── dependencies.py        # get_current_user, require_admin
│       ├── websockets.py          # Endpoint WebSocket
│       │
│       └── routers/
│           ├── auth.py            # /api/auth/* (Compartido)
│           ├── mobile.py          # /api/driver/* (Conductores)
│           └── shared.py          # /api/units, /api/alerts, etc.
│
├── requirements.txt               # Dependencias Python
├── .env.example                   # Plantilla de variables de entorno
├── .gitignore
└── README.md

```

## Instalación

### 1. Clonar y configurar

```bash
cd safedrive-backend
cp .env.example .env
```

### 2. Editar `.env`

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=safedrive
JWT_SECRET=tu-super-secret-key-aqui
CORS_ORIGINS=http://localhost:3000,http://localhost:19000
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Ejecutar

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

O desde el directorio raíz:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

### Autenticación (Compartido)

```
POST   /api/auth/register          # Crear cuenta
POST   /api/auth/login             # Iniciar sesión
GET    /api/auth/me                # Obtener perfil
POST   /api/auth/logout            # Cerrar sesión
```

### Conductor (Mobile)

```
GET    /api/driver/unit            # Obtener unidad y track
POST   /api/driver/trip/start      # Iniciar viaje
POST   /api/driver/trip/stop       # Terminar viaje
POST   /api/driver/telemetry       # Enviar punto de telemetría
POST   /api/driver/telemetry/batch # Enviar lote de puntos
POST   /api/driver/panic           # Botón de pánico
POST   /api/driver/distracted      # Alerta de distracción
GET    /api/driver/alerts          # Obtener alertas
GET    /api/driver/chat            # Obtener chat
POST   /api/driver/chat            # Enviar mensaje
GET    /api/driver/monitor-contact # Contacto del monitorista
```

### Monitoreo (Compartido)

```
GET    /api/units                  # Listar todas las unidades
GET    /api/units/{unit_id}        # Obtener detalles de unidad
GET    /api/alerts                 # Listar alertas
POST   /api/alerts/{alert_id}      # Actualizar estado de alerta
GET    /api/stats                  # Estadísticas del centro
GET    /api/units/{unit_id}/chat   # Obtener chat con unidad
POST   /api/units/{unit_id}/chat   # Enviar mensaje a unidad
```

### WebSocket

```
WS     /api/ws                     # Real-time updates
```

## Flujo de Autenticación

### Conductor (Driver)

1. **Register**: Crea usuario tipo `driver` + auto-genera unidad
2. **Login**: Token con `token_version` + `session_id` (single session)
3. **Endpoints**: Acceso a `/api/driver/*`

### Operador (Admin/Operator)

1. **Register**: Crea usuario tipo `operator` (sin unidad)
2. **Login**: Token con permisos de admin
3. **Endpoints**: Acceso a `/api/units`, `/api/alerts`, etc.

## Procesamiento de Telemetría

El motor de telemetría (`telemetry_engine.py`) analiza cada punto:

✓ **Detección de pánico**: Botón de pánico activado
✓ **Detección de distracciones**: Intento de salir de SafeDrive
✓ **Jammers**: Pérdida de señal fuera de zona muerta
✓ **G-Force**: Impactos o frenados de pánico
✓ **Cruces fiscales**: Entrada/salida de puentes
✓ **Desvíos de ruta**: Salida del corredor autorizado
✓ **Exceso de velocidad**: Superar límite de 95 km/h

Cada evento genera una **alerta deduplicada** (máx 1 por tipo cada 30s).

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MONGO_URL` | `mongodb://localhost:27017` | URL de conexión MongoDB |
| `DB_NAME` | `safedrive` | Nombre de la BD |
| `JWT_SECRET` | `dev-secret-key-change-in-prod` | Clave para firmar JWT |
| `JWT_ALGORITHM` | `HS256` | Algoritmo JWT |
| `CORS_ORIGINS` | `*` | Orígenes CORS permitidos |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | URL de OSRM |
| `LOG_LEVEL` | `INFO` | Nivel de logging |

## Migración desde backends antiguos

### SafeDrivePage → Backend Unificado

1. El nuevo backend contiene toda la lógica de monitoreo
2. Los endpoints de planes y onboarding se pueden agregar en router separado
3. Usa la misma BD MongoDB

### SafeDriveMobil → Backend Unificado

1. El nuevo backend implementa `/api/driver/*`
2. Mantiene single-session enforcement
3. Telemetry engine igual pero mejorado

## Modelos MongoDB

```javascript
// Users
{
  "_id": ObjectId,
  "id": "uuid",
  "email": "user@example.com",
  "password_hash": "bcrypt_hash",
  "name": "Nombre",
  "role": "driver" | "operator" | "admin",
  "phone": "1234567890",
  "token_version": 1,
  "current_session_id": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}

// Units
{
  "_id": ObjectId,
  "id": "uuid",
  "driver_id": "uuid",
  "name": "NL-01",
  "plate": "ABC-1234",
  "lat": 27.4763,
  "lng": -99.5164,
  "speed": 45.5,
  "status": "en_ruta" | "detenido" | "alerta" | "offline",
  "assigned_route": [[lat, lng], ...],
  "fiscal": {"active": false, "bridge": "name", "entry": "iso8601"},
  "last_update": "2024-01-01T00:00:00Z"
}

// Alerts
{
  "_id": ObjectId,
  "id": "uuid",
  "unit_id": "uuid",
  "type": "panico" | "desvio" | "jammer" | "impacto",
  "severity": "critical" | "warning",
  "message": "...",
  "status": "active" | "acknowledged" | "resolved",
  "created_at": "2024-01-01T00:00:00Z",
  "resolved_at": null
}

// Positions (histórico de trazas)
{
  "_id": ObjectId,
  "unit_id": "uuid",
  "lat": 27.4763,
  "lng": -99.5164,
  "speed": 45.5,
  "ts": "2024-01-01T00:00:00Z"
}

// Chat
{
  "_id": ObjectId,
  "id": "uuid",
  "unit_id": "uuid",
  "sender": "driver" | "base",
  "text": "...",
  "quick": false,
  "created_at": "2024-01-01T00:00:00Z"
}

// Crossings (histórico de cruces fiscales)
{
  "_id": ObjectId,
  "id": "uuid",
  "unit_id": "uuid",
  "bridge": "Puente del Comercio Mundial",
  "entry": "2024-01-01T12:00:00Z",
  "exit": "2024-01-01T12:15:00Z",
  "minutes": 15.5
}
```

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Render.com / Railway

Especifica `requirements.txt` y run command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Testing

```bash
# Instalar dependencias de test
pip install pytest pytest-asyncio httpx

# Ejecutar tests
pytest tests/
```

## Licencia

Copyright © 2024 SafeDrive. Todos los derechos reservados.
"""
