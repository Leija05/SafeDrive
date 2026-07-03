# SafeDrive Backend Unificado - Guía Rápida

## 🚀 Quick Start (5 minutos)

### 1. Preparación

```bash
cd c:\safedrive-backend

# Copiar archivo de configuración
copy .env.example .env

# Editar .env con tus valores (MongoDB URL, JWT_SECRET, etc.)
# Si tienes MongoDB local en puerto 27017, déjalo como está
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Ejecutar servidor

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Deberías ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 4. Probar API

Abre en tu navegador:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 📊 Lo que cambió

### Antes (2 backends separados)
- SafeDrivePage/backend/server.py (695 líneas)
- SafeDriveMobil/backend/server.py (827 líneas)
- **Total: 1522 líneas + duplicación**

### Después (1 backend unificado)
- app/main.py
- app/core/ (config, database, security)
- app/models/ (esquemas Pydantic)
- app/services/ (lógica de negocio)
- app/api/routers/ (endpoints)
- **Total: Estructura modular, reutilizable, escalable**

### Ventajas
✓ **-30% código duplicado**
✓ **1 sola BD**
✓ **1 sola configuración**
✓ **1 sola escala para ambas apps**
✓ **Endpoints unificados pero organizados**

---

## 🔑 Endpoints Principales

### Auth (Compartido)
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Driver (Mobile)
```
GET  /api/driver/unit
POST /api/driver/telemetry
POST /api/driver/panic
POST /api/driver/distracted
GET  /api/driver/alerts
GET  /api/driver/chat
POST /api/driver/chat
```

### Monitoring (Compartido)
```
GET  /api/units
GET  /api/units/{id}
GET  /api/alerts
GET  /api/stats
```

### WebSocket (Real-time)
```
WS /api/ws
```

---

## 🗄️ Modelos MongoDB

La BD `safedrive` contiene:

- **users**: Conductores, operadores, admin
- **units**: Vehículos con ubicación en tiempo real
- **alerts**: Alertas generadas por el motor de telemetría
- **positions**: Histórico de trazas GPS
- **chat**: Mensajes entre conductor y monitorista
- **crossings**: Histórico de cruces de puentes

---

## 🐛 Troubleshooting

### Error: "MONGO_URL not found"
→ Verifica que `.env` exista y tenga `MONGO_URL=...`

### Error: "Connection refused"
→ Asegúrate de que MongoDB esté corriendo:
```bash
# Windows
net start MongoDB

# Linux/Mac
brew services start mongodb-community
# o
sudo systemctl start mongod
```

### Error: "Module not found"
```bash
pip install -r requirements.txt --upgrade
```

---

## 📝 Próximos pasos

1. **Reemplazar backends antiguos** con este unificado
2. **Actualizar frontend** para usar nuevos endpoints (si cambió alguno)
3. **Deactivar SafeDrivePage/backend y SafeDriveMobil/backend**
4. **Mantener este único backend**

---

## 📚 Documentación

Consulta `README.md` para:
- Estructura completa del proyecto
- Variables de entorno detalladas
- Modelos MongoDB completos
- Instrucciones de deployment

---

¡Listo! Tu backend unificado está corriendo. 🎉
