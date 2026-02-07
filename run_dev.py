import os
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd, cwd):
    print(f"\n$ {cmd}")
    # Use shell=True on Windows so npm.cmd resolves.
    proc = subprocess.run(cmd, cwd=str(cwd), shell=True)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def popen(cmd, cwd, name):
    print(f"\n[starting {name}] {cmd}")
    return subprocess.Popen(cmd, cwd=str(cwd), shell=True)


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


def main():
    backend = ROOT / "backend"

    # Preflight: ports must be free
    for port in (3000, 4000):
        if not _port_available(port):
            _print_port_help(port)
            raise SystemExit(1)

    # Preflight: backend env file (optional but strongly recommended)
    env_path = backend / ".env"
    if not env_path.exists():
        print("\nNOTE: backend/.env not found. AI routes will fail until you create it.")
        print("Create backend/.env with e.g. ANTHROPIC_API_KEY=... (or CLAUDE_API_KEY=...)")

    # Ensure deps are installed (both root and backend)
    npm = "\"C:/Program Files/nodejs/npm.cmd\""

    run(f"{npm} install", ROOT)
    run(f"{npm} install", backend)

    # Ensure HTTPS certs for Office add-ins
    cert_dir = Path.home() / ".office-addin-dev-certs"
    if not (cert_dir / "localhost.crt").exists():
        run(f"{npm} run certs:install", ROOT)

    # Start both processes
    p_backend = popen(f"{npm} run dev", backend, "backend")
    p_frontend = popen(f"{npm} run start", ROOT, "frontend")

    procs = [p_backend, p_frontend]

    def shutdown(*_):
        print("\nShutting down...")
        for p in procs:
            try:
                # Graceful first
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

    # Wait until one exits, then shutdown the other
    while True:
        codes = [p.poll() for p in procs]
        if any(c is not None for c in codes):
            print(f"\nA process exited: backend={codes[0]} frontend={codes[1]}")
            shutdown()


if __name__ == "__main__":
    main()
