import os, time, json, requests

BASE = os.environ.get("BASE", "http://127.0.0.1:8002")
VID = os.environ.get("VID", "tmp_client.mp4")
FILE = os.environ.get("FILE", os.path.join(os.path.dirname(__file__), "..", "tmp_client.mp4"))
FILE = os.path.abspath(FILE)

print("Health:", requests.get(f"{BASE}/health", timeout=5).json())
print("Uploading:")
with open(FILE, 'rb') as f:
    r = requests.post(f"{BASE}/api/v1/uploads/upload_file", files={'file': (VID, f, 'video/mp4')}, timeout=120)
    r.raise_for_status()
    print(r.json())

print("Processing:")
print(requests.post(f"{BASE}/api/v1/videos/{VID}/process", timeout=10).json())
for i in range(30):
    time.sleep(1)
    jobs = requests.get(f"{BASE}/api/v1/jobs", timeout=10).json()
    print("tick", i, [(j.get('type'), j.get('status'), j.get('progress')) for j in jobs])
    if any(j.get('type')=='clipping' and j.get('status')=='completed' for j in jobs):
        break

print("Clips:")
clips = requests.get(f"{BASE}/api/v1/videos/{VID}/clips", timeout=10).json()
print(len(clips), "clips")

print("Transcription:")
requests.post(f"{BASE}/api/v1/transcriptions/{VID}?language=es", timeout=10)
for i in range(10):
    time.sleep(0.6)
    tr = requests.get(f"{BASE}/api/v1/transcriptions/{VID}", timeout=10).json()
    if tr.get('status') == 'completed':
        break
print(tr.get('status'), len(tr.get('segments') or []), 'segments')

print("SRT snippet:")
print(requests.get(f"{BASE}/api/v1/transcriptions/{VID}/srt", timeout=10).text.splitlines()[:6])
