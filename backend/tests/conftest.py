import os, sys, pathlib, tempfile

# Path real es backend/app relativo a raíz de repo
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_ROOT / 'app'
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Tests drop and recreate every table: never point them at the development database. Set before
# any test module imports the app (the engine is created at import time).
os.environ["DATABASE_URL"] = f"sqlite:///{pathlib.Path(tempfile.gettempdir()) / 'autoyt_pytest.db'}"
