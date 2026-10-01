"""Hand-label a clip at 1 s granularity for eval_motion_gate.py.

    python eval/label_clips.py uploads/<clip>.mp4

Plays each second (looping) in an OpenCV window. Keys:
    p  person present, moving        s  person present, stationary
    n  no person                     b  back one second     q  save + quit
Output: eval/labels/<clip stem>.json  {"fps":..., "seconds":[{"present":bool,"moving":bool}, ...]}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2

LABELS = Path(__file__).parent / "labels"


def main(path: str) -> None:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n_sec = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps)
    out = LABELS / f"{Path(path).stem}.json"
    secs = json.loads(out.read_text())["seconds"] if out.exists() else []
    secs += [None] * (n_sec - len(secs))
    i = next((k for k, v in enumerate(secs) if v is None), 0)

    while 0 <= i < n_sec:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i * fps))
        key = -1
        while key == -1:
            for _ in range(int(fps)):
                ok, frame = cap.read()
                if not ok:
                    break
                cv2.putText(frame, f"{i}/{n_sec}s  cur={secs[i]}  [p]moving [s]still [n]none [b]ack [q]uit",
                            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.imshow("label", frame)
                key = cv2.waitKey(int(1000 / fps))
                if key != -1:
                    break
            else:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(i * fps))
        k = chr(key & 0xFF)
        if k == "q":
            break
        if k == "b":
            i = max(0, i - 1)
            continue
        if k in "psn":
            secs[i] = {"present": k != "n", "moving": k == "p"}
            i += 1
    LABELS.mkdir(exist_ok=True)
    out.write_text(json.dumps({"fps": fps, "seconds": secs}))
    print(f"saved {out}  ({sum(s is not None for s in secs)}/{n_sec} seconds labelled)")


if __name__ == "__main__":
    main(sys.argv[1])
