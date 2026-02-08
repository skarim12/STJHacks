import os
import signal
import subprocess
import sys
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


def run(cmd: str, cwd: Path):
    print(f"\n$ {cmd}")
    proc = subprocess.run(cmd, cwd=str(cwd), shell=True)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def popen(cmd: str, cwd: Path, name: str, env=None):
    print(f"\n[starting {name}] {cmd}")
    return subprocess.Popen(cmd, cwd=str(cwd), shell=True, env=env)


def main():
    if not APP.exists():
        print(f"ERROR: expected {APP} to exist")
        raise SystemExit(1)
    if not BACKEND.exists():
        print(f"ERROR: expected {BACKEND} to exist")
        raise SystemExit(1)

    # Ports
    backend_port = int(os.environ.get("BACKEND_PORT", "3000"))
    ui_port = int(os.environ.get("UI_PORT", "3001"))

    for port in (backend_port, ui_port):
        if not _port_available(port):
            _print_port_help(port)
            raise SystemExit(1)

    # Make sure npm.cmd exists
    npm = os.environ.get("NPM_CMD", r"C:\Program Files\nodejs\npm.cmd")
    npm = f'"{npm}"'

    # Install deps (prefer reproducible installs)
    # npm ci requires a clean node_modules.
    import shutil

    for p in (APP / "node_modules", BACKEND / "node_modules"):
      if p.exists():
        print(f"\n[clean] removing {p}")
        shutil.rmtree(p, ignore_errors=True)

    run(f"{npm} ci --no-fund --no-audit", APP)
    run(f"{npm} ci --no-fund --no-audit", BACKEND)

    # Build backend
    run(f"{npm} run build", BACKEND)

    # Start backend + frontend
    env_backend = os.environ.copy()
    env_backend["PORT"] = str(backend_port)

    print("\nDev URLs:")
    print(f"  Backend: http://localhost:{backend_port}/healthz")
    print(f"  UI:      http://localhost:{ui_port}/")

    p_backend = popen(f"node dist\\server.js", BACKEND, "backend", env=env_backend)
    p_frontend = popen(f"{npm} run dev -- --port {ui_port}", APP, "frontend")

    procs = [p_backend, p_frontend]

    def shutdown(*_):
        print("\nShutting down...")
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
