import asyncio
import sys
import time

import websockets


async def main():
    video_id = sys.argv[1]
    duration = float(sys.argv[2]) if len(sys.argv) > 2 else 15.0
    uri = f"ws://localhost:8000/ws/detect/{video_id}"
    frames = 0
    violations_seen = 0
    t0 = time.monotonic()
    async with websockets.connect(uri, max_size=None) as ws:
        while time.monotonic() - t0 < duration:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            except asyncio.TimeoutError:
                break
            import json
            data = json.loads(msg)
            if data.get("type") == "frame":
                frames += 1
                if data.get("violations"):
                    violations_seen += 1
            elif data.get("type") == "error":
                print("ERROR:", data)
                break
    print(f"frames received={frames} frames_with_violations={violations_seen}")


asyncio.run(main())
