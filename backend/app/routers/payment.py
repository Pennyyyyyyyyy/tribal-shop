import asyncio
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("payment")

router = APIRouter(tags=["Payment"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("[WebSocket] 新前端連線至 /ws/payment (目前連線數: %d)", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("[WebSocket] 前端離線 (剩餘連線數: %d)", len(self.active_connections))

    async def broadcast(self, message: dict):
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dc in dead_connections:
            self.disconnect(dc)

manager = ConnectionManager()

def pulses_to_amount(pulses: int) -> int:
    """
    脈衝數轉換為硬幣金額：
    支援台灣常見投幣機配置：
    - 模式 A（脈衝直接對應金額）：1=1元, 5=5元, 10=10元, 50=50元
    - 模式 B（通道脈衝）：1=1元, 2=5元, 3=10元, 4=50元
    """
    mapping = {
        1: 1,
        2: 5,
        3: 10,
        4: 50,
        5: 5,
        10: 10,
        50: 50,
    }
    return mapping.get(pulses, pulses)

@router.websocket("/ws/payment")
async def websocket_payment_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.debug("[WebSocket] 連線例外中斷: %s", e)
        manager.disconnect(websocket)

@router.post("/api/hardware-pulse")
async def hardware_pulse(pulses: int):
    amount = pulses_to_amount(pulses)
    if amount > 0:
        await manager.broadcast({"type": "coin_inserted", "amount": amount})
        logger.info("[投幣機] 收到脈衝 %d，折合金額 NT$ %d，已廣播", pulses, amount)
    return {"status": "success", "pulses": pulses, "amount": amount}

# 提供本地或前端模擬投幣測試
@router.post("/api/mock-coin")
async def mock_coin(amount: int):
    await manager.broadcast({"type": "coin_inserted", "amount": amount})
    logger.info("[模擬投幣] 投入 NT$ %d，已廣播至前端", amount)
    return {"status": "success", "amount": amount}
