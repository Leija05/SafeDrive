"""WebSocket connection manager."""
from typing import List
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket connection manager for real-time updates."""
    
    def __init__(self):
        self.active: List[WebSocket] = []
    
    async def connect(self, ws: WebSocket):
        """Accept and add new connection."""
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WebSocket connected. Total: {len(self.active)}")
    
    def disconnect(self, ws: WebSocket):
        """Remove disconnected client."""
        if ws in self.active:
            self.active.remove(ws)
            logger.info(f"WebSocket disconnected. Total: {len(self.active)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception as e:
                dead.append(ws)
                logger.error(f"WebSocket send error: {e}")
        
        for ws in dead:
            self.disconnect(ws)

# Global instance
manager = ConnectionManager()
