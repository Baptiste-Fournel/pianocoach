"""PianoCoach as a native desktop app.

Runs the existing FastAPI backend (which also serves the built frontend) on a
free localhost port in a daemon thread, then opens a native WebKit window
(Cocoa on macOS) pointing at it. The web mode (scripts/dev.sh), the tests, and
the MCP server are untouched — this is a purely additive launcher.

    uv run python -m desktop.main          # open the window
    PIANOCOACH_DEBUG=1 uv run python -m desktop.main     # + webview devtools
    PIANOCOACH_SELFTEST=1 uv run python -m desktop.main  # headless integration check

Must run in the uv-managed Python 3.12 env (where pywebview is installed), not
the system Python.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

REPO = Path(__file__).resolve().parents[1]
FRONTEND = REPO / "frontend"
DIST = FRONTEND / "dist"
STATIC = REPO / "backend" / "static"

DEBUG = os.environ.get("PIANOCOACH_DEBUG") == "1"
SELFTEST = os.environ.get("PIANOCOACH_SELFTEST") == "1"


def ensure_frontend_built() -> None:
    """Make sure backend/static (what FastAPI serves) exists; build if needed.

    The backend decides whether to mount the SPA at import time, so this MUST
    run before `app.main` is imported.
    """
    if (STATIC / "index.html").exists():
        return
    print("Frontend non buildé — build en cours (npm run build)…", flush=True)
    if not (FRONTEND / "node_modules").exists():
        subprocess.run(["npm", "install", "--no-fund", "--no-audit"], cwd=FRONTEND, check=True)
    subprocess.run(["npm", "run", "build"], cwd=FRONTEND, check=True)
    if STATIC.exists():
        shutil.rmtree(STATIC)
    shutil.copytree(DIST, STATIC)
    print("Frontend buildé et copié dans backend/static.", flush=True)


def pick_free_port() -> int:
    """Bind to port 0 on loopback to let the OS choose a free port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_until_ready(url: str, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1) as resp:  # noqa: S310 - fixed localhost URL
                if resp.status == 200:
                    return True
        except (URLError, OSError):
            pass
        time.sleep(0.2)
    return False


def start_server(port: int):
    """Start uvicorn in a daemon thread. Returns (server, thread)."""
    import uvicorn
    from app.main import app  # imported AFTER ensure_frontend_built()

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, name="uvicorn", daemon=True)
    thread.start()
    return server, thread


def _run_selftest(base: str, server) -> int:
    """Headless verification of the server integration (no GUI window)."""
    import json

    ok = True
    try:
        with urlopen(f"{base}/", timeout=3) as r:  # noqa: S310
            html = r.read().decode("utf-8", "replace")
            spa = r.status == 200 and 'id="root"' in html
            print(f"  / (SPA index.html)     : {'OK' if spa else 'ÉCHEC'}")
            ok = ok and spa
        with urlopen(f"{base}/api/dashboard", timeout=5) as r:  # noqa: S310
            data = json.loads(r.read())
            live = r.status == 200 and "projections" in data and "streak" in data
            n = len(data.get("projections", []))
            print(f"  /api/dashboard (live)  : {'OK' if live else 'ÉCHEC'} ({n} projections)")
            ok = ok and live
    except Exception as e:  # noqa: BLE001
        print(f"  ÉCHEC selftest: {type(e).__name__}: {e}")
        ok = False
    finally:
        server.should_exit = True  # clean shutdown, no orphan uvicorn
    print("SELFTEST OK" if ok else "SELFTEST ÉCHEC")
    return 0 if ok else 1


def _build_menu(window, base: str):
    """Minimal native menu (Recharger / Quitter). Best-effort across versions."""
    try:
        import webview
        from webview.menu import Menu, MenuAction

        def reload_window() -> None:
            window.load_url(f"{base}/")

        def quit_app() -> None:
            try:
                window.destroy()
            except Exception:  # noqa: BLE001
                webview.windows and webview.windows[0].destroy()

        return [Menu("PianoCoach", [MenuAction("Recharger", reload_window), MenuAction("Quitter", quit_app)])]
    except Exception:  # noqa: BLE001 - menu is a bonus; never block startup
        return []


def main() -> int:
    ensure_frontend_built()

    port = pick_free_port()
    base = f"http://127.0.0.1:{port}"
    server, _thread = start_server(port)

    if not wait_until_ready(f"{base}/api/health"):
        print("Le serveur n'a pas répondu dans le délai imparti.", file=sys.stderr)
        server.should_exit = True
        return 1

    if SELFTEST:
        return _run_selftest(base, server)

    import webview

    window = webview.create_window(
        "PianoCoach",
        f"{base}/",
        width=1400,
        height=900,
        min_size=(1024, 720),
    )

    menu = _build_menu(window, base)
    try:
        # webview.start() MUST run on the main thread (Cocoa requirement); the
        # server runs in the daemon thread started above.
        if menu:
            webview.start(debug=DEBUG, menu=menu)
        else:
            webview.start(debug=DEBUG)
    except TypeError:
        # Older/newer pywebview without the menu kwarg — start without it.
        webview.start(debug=DEBUG)
    finally:
        server.should_exit = True  # closing the window stops uvicorn cleanly

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
