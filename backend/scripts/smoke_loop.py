import os, time, subprocess, sys

BASE = os.environ.get("BASE", "http://127.0.0.1:8002")
PY = sys.executable
SCRIPT = os.path.join(os.path.dirname(__file__), 'smoke.py')

print("[smoke_loop] Running forever. Ctrl+C to stop.")
while True:
    try:
        subprocess.run([PY, SCRIPT], check=True)
    except Exception as e:
        print("[smoke_loop] error:", e)
    time.sleep(5)
