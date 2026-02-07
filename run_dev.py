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


def main():
    backend = ROOT / "backend"

    # Ensure deps are installed (both root and backend)
    run("npm install", ROOT)
    run("npm install", backend)

    # Start both processes
    p_backend = popen("npm run dev", backend, "backend")
    p_frontend = popen("npm run start", ROOT, "frontend")

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
