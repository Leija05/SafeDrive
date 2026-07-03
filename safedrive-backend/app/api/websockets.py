"""WebSocket endpoint for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from app.services.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket endpoint for real-time tracking and updates."""
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(ws)
