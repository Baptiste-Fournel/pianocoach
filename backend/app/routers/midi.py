"""MIDI status + live note stream (WebSocket)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services import midi

router = APIRouter(prefix="/midi", tags=["midi"])


@router.get("/status")
def status():
    """Is a MIDI backend available, and which input ports are connected?"""
    return {"available": midi.available(), "ports": midi.list_input_ports()}


@router.websocket("/stream")
async def stream(ws: WebSocket, port: str | None = None):
    """Stream note_on/note_off events from a MIDI input to the client."""
    await ws.accept()

    if not midi.available():
        await ws.send_json({"error": "MIDI indisponible sur cette machine (backend rtmidi absent)."})
        await ws.close()
        return

    name = midi.resolve_port(port)
    if not name:
        await ws.send_json({"error": "Aucun port MIDI détecté. Branche ton piano en USB puis réessaie."})
        await ws.close()
        return

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def on_message(msg) -> None:  # runs on rtmidi's thread
        if msg.type not in ("note_on", "note_off"):
            return
        velocity = getattr(msg, "velocity", 0)
        kind = "note_on" if (msg.type == "note_on" and velocity > 0) else "note_off"
        loop.call_soon_threadsafe(queue.put_nowait, {"type": kind, "note": msg.note, "velocity": velocity})

    try:
        inport = midi.open_input(name, on_message)
    except Exception as e:  # noqa: BLE001
        await ws.send_json({"error": f"Impossible d'ouvrir le port MIDI : {e}"})
        await ws.close()
        return

    await ws.send_json({"connected": True, "port": name})

    async def forward() -> None:
        while True:
            await ws.send_json(await queue.get())

    sender = asyncio.create_task(forward())
    try:
        # Block on receive so a client disconnect is detected promptly; the
        # sender task streams events concurrently.
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        sender.cancel()
        inport.close()
