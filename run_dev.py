import os
import signal
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "powerpoint-ai-addin"
BACKEND = APP / "backend"


def _port_available(port: int) -> bool:
    import socket

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        try:
            s.close()
        except Exception:
            pass


def _print_port_help(port: int):
    if os.name != "nt":
        print(f"Port {port} is in use. Stop the process using it and retry.")
        return

    print(f"\nERROR: Port {port} is already in use.")
    print("Run this in PowerShell to see what's holding it:")
    print(f"  Get-NetTCPConnection -LocalPort {port} | Select OwningProcess,State,LocalPort")
    print("Then stop it:")
    print("  Stop-Process -Id <PID> -Force")


def _find_free_port(start: int, end: int) -> int:
    for p in range(start, end + 1):
        if _port_available(p):
            return p
    raise RuntimeError(f"No free ports in range {start}-{end}")


def run(cmd: str, cwd: Path):
    print(f"\n$ {cmd}", flush=True)
    proc = subprocess.run(cmd, cwd=str(cwd), shell=True)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def popen(cmd: str, cwd: Path, name: str, env=None):
    print(f"\n[starting {name}] {cmd}", flush=True)
    return subprocess.Popen(cmd, cwd=str(cwd), shell=True, env=env)


def main():
    if not APP.exists():
        print(f"ERROR: expected {APP} to exist")
        raise SystemExit(1)
    if not BACKEND.exists():
        print(f"ERROR: expected {BACKEND} to exist")
        raise SystemExit(1)

    # Ports: allow override, otherwise auto-pick free ports.
    backend_port = int(os.environ.get("BACKEND_PORT", "0") or 0)
    ui_port = int(os.environ.get("UI_PORT", "0") or 0)

    if backend_port <= 0:
        backend_port = _find_free_port(3000, 3010)
    if ui_port <= 0:
        ui_port = _find_free_port(3001, 3020)

    # Make sure npm.cmd exists
    npm_path = os.environ.get("NPM_CMD", r"C:\Program Files\nodejs\npm.cmd")
    npm = f'"{npm_path}"'

    # Install deps
    fast = os.environ.get("FAST_DEV", "").lower() in ("1", "true", "yes")

    if fast:
        print("\n[fast] skipping clean install (FAST_DEV=1)", flush=True)
        run(f"{npm} install --no-fund --no-audit", APP)
        run(f"{npm} install --no-fund --no-audit", BACKEND)
    else:
        import shutil

        for p in (APP / "node_modules", BACKEND / "node_modules"):
            if p.exists():
                print(f"\n[clean] removing {p}", flush=True)
                shutil.rmtree(p, ignore_errors=True)

        run(f"{npm} ci --no-fund --no-audit", APP)
        run(f"{npm} ci --no-fund --no-audit", BACKEND)

    # Build backend
    run(f"{npm} run build", BACKEND)

    # Start backend + frontend
    env_backend = os.environ.copy()
    env_backend["PORT"] = str(backend_port)

    print("\nDev URLs:", flush=True)
    print(f"  Backend: http://localhost:{backend_port}/healthz", flush=True)
    print(f"  UI:      http://localhost:{ui_port}/", flush=True)
    print("\nRunning. Press Ctrl+C to stop.", flush=True)

    p_backend = popen("node dist\\server.js", BACKEND, "backend", env=env_backend)
    env_frontend = os.environ.copy()
    env_frontend["BACKEND_PORT"] = str(backend_port)
    p_frontend = popen(f"{npm} run dev -- --port {ui_port}", APP, "frontend", env=env_frontend)

    procs = [p_backend, p_frontend]

    def shutdown(*_):
        print("\nShutting down...", flush=True)
        for p in procs:
            try:
                p.send_signal(signal.CTRL_BREAK_EVENT if os.name == "nt" else signal.SIGINT)
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=10)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        raise SystemExit(0)

    signal.signal(signal.SIGINT, shutdown)
    if os.name != "nt":
        signal.signal(signal.SIGTERM, shutdown)

    while True:
        codes = [p.poll() for p in procs]
        if any(c is not None for c in codes):
            print(f"\nA process exited: backend={codes[0]} frontend={codes[1]}")
            shutdown()


if __name__ == "__main__":
    main()
