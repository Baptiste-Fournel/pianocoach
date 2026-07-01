"""MIDI input plumbing for the Kawai CN201 (or any USB-MIDI keyboard).

Web MIDI is unavailable inside the pywebview/WKWebView shell, so the backend
owns MIDI: it reads input via mido + python-rtmidi and the router streams the
note events to the frontend over a WebSocket. Everything degrades gracefully
when no MIDI backend or device is present (returns empty / "unavailable").

mido/rtmidi are imported lazily so importing this module never fails on a host
without a MIDI backend (e.g. CI on Linux).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


def _mido() -> Any:
    import mido

    mido.set_backend("mido.backends.rtmidi")
    return mido


def available() -> bool:
    """True if a MIDI backend (rtmidi) is installed and usable."""
    try:
        import rtmidi  # noqa: F401

        _mido()
        return True
    except Exception:
        return False


def list_input_ports() -> list[str]:
    if not available():
        return []
    try:
        return list(_mido().get_input_names())
    except Exception:
        return []


def resolve_port(preferred: str | None) -> str | None:
    """Pick the requested port if present, else the first available one."""
    ports = list_input_ports()
    if preferred and preferred in ports:
        return preferred
    return ports[0] if ports else None


def open_input(name: str, callback: Callable[[Any], None]):
    """Open a MIDI input port with a message callback (runs on rtmidi's thread)."""
    return _mido().open_input(name, callback=callback)
