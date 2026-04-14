from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
import traceback
from services.scraper_agent import ScraperAgent

router = APIRouter(prefix="/api/ws", tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

@router.websocket("/scrape-progress/{client_id}")
async def scrape_progress(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                req_data = json.loads(data)
            except json.JSONDecodeError:
                continue

            if req_data.get("action") == "start_scraping":
                location = req_data.get("location", "Unknown Location")
                bhk = req_data.get("bhk", "Any BHK")

                scraper = ScraperAgent(websocket)

                # Run scraping in a task with error handling
                async def _run_scrape():
                    try:
                        await scraper.run_scrape_workflow(location, bhk)
                    except WebSocketDisconnect:
                        pass  # Client left, that's fine
                    except Exception as e:
                        # Try to notify the client of the error
                        try:
                            await websocket.send_text(json.dumps({
                                "progress": 100,
                                "status": f"Scraping error: {str(e)[:120]}. Please retry.",
                                "found_count": 0,
                            }))
                        except Exception:
                            pass

                asyncio.create_task(_run_scrape())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
