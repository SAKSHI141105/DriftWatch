"""WebSocket endpoint for real-time alert streaming to the dashboard."""

from __future__ import annotations

import asyncio
import json
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import get_recent_alerts

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Send initial recent alerts upon connecting
        try:
            recent = get_recent_alerts(limit=5)
            await websocket.send_json({"type": "INIT", "data": recent})
        except Exception as e:
            print(f"Error sending init WS data: {e}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_alert(self, alert_data: dict):
        """Broadcast a newly flagged alert to all connected dashboard clients."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json({"type": "NEW_ALERT", "data": alert_data})
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


@router.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and listen for client ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
