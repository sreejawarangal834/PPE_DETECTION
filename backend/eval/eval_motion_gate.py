"""Measure motion-gate accuracy and compute savings for the motion -> person -> PPE chain.

    python eval/eval_motion_gate.py uploads/*.mp4                 # labelled clips only
    python eval/eval_motion_gate.py uploads/*.mp4 --proxy         # also use yolo11n presence as proxy labels
    python eval/eval_motion_gate.py uploads/X.mp4 --sweep         # grid over thresholds/methods

Ground truth (eval/labels/<stem>.json, from label_clips.py): "should run" == person present in that
second (a stationary worker must still be checked). Replays frames exactly as the uploaded-video
path does (1-in-(FRAME_SKIP+1), resized to IMAGE_SIZE) with a simulated clock so the grace and
force-run timers behave as in real time.

Metrics per config: recall on person-present frames (the number that matters — a miss = an
unchecked worker), stationary-worker recall, false-trigger rate on empty frames, precision, F1,
and the % of frames where the person model / PPE model would be skipped.
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import motion_gate  # noqa: E402

LABELS = Path(__file__).parent / "labels"


class _Clock:
    t = 0.0

    @classmethod
    def monotonic(cls) -> float:
        return cls.t


motion_gate.time = _Clock  # simulated time; only .monotonic() is used by motion_gate


def _resize(frame: np.ndarray, max_w: int) -> np.ndarray:
    h, w = frame.shape[:2]
    return frame if w <= max_w else cv2.resize(frame, (max_w, int(h * max_w / w)))


def load_frames(path: str) -> tuple[list[tuple[float, np.ndarray]], float]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    out, idx = [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % (config.FRAME_SKIP + 1) == 0:
            out.append((idx / fps, _resize(frame, config.IMAGE_SIZE)))
        idx += 1
    return out, fps


def proxy_labels(frames: list[tuple[float, np.ndarray]]) -> list[dict]:
    """Presence per second from yolo11n at production settings (approximate — validate by hand)."""
    import person_gate
    per_sec: dict[int, list[bool]] = {}
    for t, f in frames:
        b = person_gate.detect_persons(f)
        per_sec.setdefault(int(t), []).append(bool(b))
    return [{"present": sum(v) > len(v) / 2, "moving": None} for _, v in sorted(per_sec.items())]


@dataclass
class Tally:
    tp = fn = fp = tn = 0
    still_tp = still_fn = 0
    frames = 0


def run_config(clips, labels, person_boxes=None) -> dict:
    """Replay every clip; returns aggregate metrics. Gate is frame_has_motion only (stage 0)
    unless person_boxes is given, in which case the full chain decision is also scored."""
    T = Tally()
    for name, frames in clips.items():
        state = motion_gate.new_session_state()
        _Clock.t = frames[0][0] if frames else 0.0
        state.last_motion_at = state.last_pregate_forced_at = state.last_forced_run_at = _Clock.t
        secs = labels[name]
        for t, f in frames:
            _Clock.t = t
            s = int(t)
            if s >= len(secs) or secs[s] is None:
                continue
            lab = secs[s]
            run = motion_gate.frame_has_motion(state, f)
            T.frames += 1
            if lab["present"]:
                if run:
                    T.tp += 1
                else:
                    T.fn += 1
                if lab.get("moving") is False:
                    T.still_tp += run
                    T.still_fn += (not run)
            else:
                T.fp += run
                T.tn += (not run)
    rec = T.tp / max(1, T.tp + T.fn)
    prec = T.tp / max(1, T.tp + T.fp)
    return {
        "recall": rec, "precision": prec, "f1": 2 * rec * prec / max(1e-9, rec + prec),
        "stationary_recall": T.still_tp / max(1, T.still_tp + T.still_fn) if (T.still_tp + T.still_fn) else None,
        "false_trigger_rate": T.fp / max(1, T.fp + T.tn),
        "skip_rate": (T.fn + T.tn) / max(1, T.frames), "frames": T.frames,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("clips", nargs="+")
    ap.add_argument("--proxy", action="store_true", help="use yolo11n presence as labels where no hand labels exist")
    ap.add_argument("--sweep", action="store_true")
    a = ap.parse_args()

    clips, labels = {}, {}
    for p in a.clips:
        stem = Path(p).stem
        lf = LABELS / f"{stem}.json"
        if lf.exists():
            labels[stem] = json.loads(lf.read_text())["seconds"]
            clips[stem], _ = load_frames(p)
        elif a.proxy:
            clips[stem], _ = load_frames(p)
            labels[stem] = proxy_labels(clips[stem])
            print(f"[proxy labels] {stem}")
        else:
            print(f"skip {stem}: no labels (run label_clips.py or pass --proxy)")
    if not clips:
        sys.exit("no labelled clips")

    grid = {"MOTION_GATE_METHOD": [config.MOTION_GATE_METHOD], "MOTION_DIFF_THRESHOLD": [config.MOTION_DIFF_THRESHOLD],
            "MOTION_GLOBAL_MIN_FRACTION": [config.MOTION_GLOBAL_MIN_FRACTION],
            "MOTION_GATE_GRACE_SECONDS": [config.MOTION_GATE_GRACE_SECONDS],
            "MOTION_GATE_FORCE_INTERVAL_SECONDS": [config.MOTION_GATE_FORCE_INTERVAL_SECONDS]}
    if a.sweep:
        grid.update({"MOTION_GATE_METHOD": ["diff", "mog2", "knn"], "MOTION_DIFF_THRESHOLD": [10, 20, 30],
                     "MOTION_GLOBAL_MIN_FRACTION": [0.0005, 0.001, 0.003, 0.01],
                     "MOTION_GATE_GRACE_SECONDS": [2.0, 5.0], "MOTION_GATE_FORCE_INTERVAL_SECONDS": [2.0, 5.0]})
    keys = list(grid)
    rows = []
    for combo in itertools.product(*grid.values()):
        for k, v in zip(keys, combo):
            setattr(config, k, v)
        rows.append((dict(zip(keys, combo)), run_config(clips, labels)))

    rows.sort(key=lambda r: (r[1]["recall"] >= 0.95, r[1]["skip_rate"]), reverse=True)
    for cfg, m in rows[: 15 if a.sweep else 1]:
        st = m["stationary_recall"]
        print(f"recall={m['recall']:.3f} stationary_recall={'n/a' if st is None else f'{st:.3f}'} "
              f"precision={m['precision']:.3f} f1={m['f1']:.3f} false_trig={m['false_trigger_rate']:.3f} "
              f"skip={m['skip_rate']:.1%} frames={m['frames']}  {cfg}")
    best = rows[0]
    ok = best[1]["recall"] >= 0.95
    print(f"\nBest {'meets' if ok else 'MISSES'} the recall>=0.95 target.")


if __name__ == "__main__":
    main()
