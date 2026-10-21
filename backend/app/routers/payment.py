import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter(tags=["Payment"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws/payment")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.post("/api/hardware-pulse")
async def hardware_pulse(pulses: int):
    amount = 0
    if pulses == 1:
        amount = 1
    elif pulses == 2:
        amount = 5
    elif pulses == 3:
        amount = 10
    
    if amount > 0:
        await manager.broadcast({"type": "coin_inserted", "amount": amount})
    
    return {"status": "success", "pulses": pulses, "amount": amount}

# Mock API
@router.post("/api/mock-coin")
async def mock_coin(amount: int):
    await manager.broadcast({"type": "coin_inserted", "amount": amount})
    return {"status": "success", "amount": amount}
