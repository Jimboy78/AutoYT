import sys, pathlib

# Path real es backend/app relativo a raíz de repo
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_ROOT / 'app'
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
