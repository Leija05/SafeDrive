"""WebSocket endpoint for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from app.services.ws_manager import manager
from app.core.security import decode_token, get_user_from_payload

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint with JWT authentication."""
    token = ws.query_params.get("token", "")
    if not token:
        await ws.close(code=4001, reason="No autenticado")
        return

    try:
        payload = decode_token(token)
        user = await get_user_from_payload(payload)
    except Exception as e:
        logger.warning(f"WebSocket auth rejected: {e}")
        await ws.close(code=4001, reason="Token invalido")
        return

    await manager.connect(ws)
    logger.info(f"WebSocket authenticated: {user.get('email')} ({user.get('role')})")
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(ws)
