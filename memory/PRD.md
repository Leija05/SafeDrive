# SafeDrive GPS — PRD

## Problema original
Ecosistema fronterizo de seguridad activa y telemetria en tiempo real para autotransporte de carga (Monterrey ↔ Nuevo Laredo). Mitiga robo de mercancia y accidentes por distraccion. 3 componentes: App Movil (escudo del operador), Backend Analitico (el cerebro), Dashboard Web Bento Grid (centro de control). Incluye modulo de cruce transfronterizo y esquema comercial (planes Bronce/Plata/Oro).

## Arquitectura
- Backend: FastAPI + MongoDB (motor) + WebSockets (`/api/ws`). Auth JWT Bearer (bcrypt). Cerebro analitico en `process_telemetry`.
- Frontend: React 19 + Tailwind + Shadcn + Leaflet/OpenStreetMap + @phosphor-icons. Estetica "Tactical Command Center" (dark only).
- Tiempo real via WebSocket broadcast (unit_update, alert, chat, crossings).

## Personas
- Monitorista en oficina (Dashboard de control).
- Chofer/operador (App movil real integrada por telemetria).
- Cliente/empresa transportista (Landing comercial + carrito).

## Implementado (2026-06-23)
- Auth JWT + seed admin (leijahector5@gmail.com / /Leija091105).
- Backend analitico: desvio de corredor >400m, filtro de acelerometro (impacto sostenido vs caida de celular), deteccion de jammer (senal perdida fuera de zona muerta), geocerca de Espera Fiscal en puentes con cronometro, exceso de velocidad, panico.
- Telemetria `/api/telemetry` para datos reales recibidos desde la app movil y analizados por el backend.
- Dashboard Bento Grid: 6 metricas, mapa Leaflet en vivo (se expande en alerta critica), panel de alertas (difundir/chat/resolver), mesa de ayuda reactiva (unidades con alerta suben), chat seguro, panel de cruces transfronterizos.
- Landing comercial: planes Bronce/Plata/Oro con selector de ciclo, onboarding, carrito tipo tienda, checkout via WhatsApp (528674718298) y correo (leijahector5@gmail.com).
- Suite de regresion backend: `/app/backend/tests/backend_test.py` para auth, unidades, telemetria, alertas, chat y estadisticas.

## Backlog priorizado
- P1: Autenticar `/api/telemetry` con device token / IMEI binding real.
- P1: Limite de dispositivos por plan (IMEI) y candado de activacion por hardware (antipirateria).
- P2: Persistir rutas/corredores configurables por cliente; historial y reportes de cruces (export CSV).
- P2: Notificaciones push reales, integracion de difusion a clientes (correo/WhatsApp automatico).
- P2: Refactor server.py en modulos (routers/services/geo).

## Proximos pasos
- Recoger feedback del usuario sobre UX del dashboard y app movil.
- Definir reglas exactas de planes (limite de teléfonos enforced) e integrar pago si se desea.
