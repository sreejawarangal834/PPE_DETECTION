"""Motion-gate accuracy on CDnet 2014 (pixel-level ground truth, no hand labelling).

    python eval/eval_cdnet.py [--root ../../datasets/motion_eval/CDnet14] [--sweep] [--min-gt-pixels 50]

Per-frame truth: motion present == at least --min-gt-pixels ground-truth pixels equal 255 ("Moving"),
inside the video's temporalROI. Two modes per config:
  raw   grace=0, force-run off  -> pure motion-detector accuracy (precision/recall/F1)
  prod  production grace + force-run valves -> what the chain actually does (recall on real
        motion should stay ~1; skip rate is the compute saved)
Frames are subsampled 1-in-(FRAME_SKIP+1) like the uploaded-video path; the simulated clock
assumes 25 fps source video (CDnet is 25-30 fps).
"""
from __future__ import annotations

import argparse
import itertools
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_motion_gate import _Clock, motion_gate, config  # noqa: E402  (also installs the simulated clock)

FPS = 25.0


def load(video: Path, min_px: int):
    lo, hi = map(int, (video / "temporalROI.txt").read_text().split()[:2])
    roi = cv2.imread(str(video / "ROI.bmp"), 0)
    frames, truth = [], []
    for n in range(lo, hi + 1, config.FRAME_SKIP + 1):
        img = cv2.imread(str(video / "input" / f"in{n:06d}.jpg"))
        gt = cv2.imread(str(video / "groundtruth" / f"gt{n:06d}.png"), 0)
        if gt is None:
            gt = cv2.imread(str(video / "groundtruth" / f"gt{n:06d}.bmp"), 0)
        if img is None or gt is None:
            continue
        frames.append((n / FPS, img))
        m = gt == 255
        if roi is not None:
            r = roi if roi.shape == gt.shape else cv2.resize(roi, gt.shape[::-1], interpolation=cv2.INTER_NEAREST)
            m &= r > 0
        truth.append(int(np.count_nonzero(m)) >= min_px)
    return frames, truth


def run(videos, mode: str):
    if mode == "raw":
        config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = 0.0, 1e9
    tp = fn = fp = tn = 0
    for frames, truth in videos:
        st = motion_gate.new_session_state()
        _Clock.t = frames[0][0]
        st.last_motion_at = float("-inf")
        st.last_pregate_forced_at = st.last_forced_run_at = _Clock.t
        for (t, f), y in zip(frames, truth):
            _Clock.t = t
            run_ = motion_gate.frame_has_motion(st, f)
            if y:
                tp += run_; fn += (not run_)
            else:
                fp += run_; tn += (not run_)
    rec, prec = tp / max(1, tp + fn), tp / max(1, tp + fp)
    return dict(recall=rec, precision=prec, f1=2 * rec * prec / max(1e-9, rec + prec),
                skip=(fn + tn) / max(1, tp + fn + fp + tn), false_trig=fp / max(1, fp + tn), n=tp + fn + fp + tn)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[3] / "datasets/motion_eval/CDnet14"))
    ap.add_argument("--sweep", action="store_true")
    ap.add_argument("--min-gt-pixels", type=int, default=50)
    ap.add_argument("--videos", nargs="*", help="category/video, default: all extracted")
    a = ap.parse_args()

    dirs = [Path(a.root) / v for v in a.videos] if a.videos else sorted(p for p in Path(a.root).glob("*/*") if p.is_dir())
    vids = {}
    for d in dirs:
        vids[f"{d.parent.name}/{d.name}"] = load(d, a.min_gt_pixels)
        pos = sum(vids[f"{d.parent.name}/{d.name}"][1])
        print(f"loaded {d.parent.name}/{d.name}: {len(vids[f'{d.parent.name}/{d.name}'][1])} frames, {pos} with motion")

    grid = dict(MOTION_GATE_METHOD=[config.MOTION_GATE_METHOD], MOTION_DIFF_THRESHOLD=[config.MOTION_DIFF_THRESHOLD],
                MOTION_GLOBAL_MIN_FRACTION=[config.MOTION_GLOBAL_MIN_FRACTION])
    saved = (config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS)
    if a.sweep:
        grid = dict(MOTION_GATE_METHOD=["diff", "mog2", "knn"], MOTION_DIFF_THRESHOLD=[10, 15, 20, 30],
                    MOTION_GLOBAL_MIN_FRACTION=[0.0005, 0.001, 0.003, 0.01])
    rows = []
    for combo in itertools.product(*grid.values()):
        for k, v in zip(grid, combo):
            setattr(config, k, v)
        if grid["MOTION_GATE_METHOD"] != ["diff"] and combo[0] != "diff" and combo[1] != grid["MOTION_DIFF_THRESHOLD"][0]:
            continue  # diff threshold is irrelevant to mog2/knn; don't repeat
        config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = saved
        raw = run(list(vids.values()), "raw")
        config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = saved
        prod = run(list(vids.values()), "prod")
        rows.append((dict(zip(grid, combo)), raw, prod))
        config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = saved

    rows.sort(key=lambda r: (r[2]["recall"] >= 0.95, r[1]["f1"]), reverse=True)
    for cfg, raw, prod in rows[:12]:
        print(f"RAW  P={raw['precision']:.3f} R={raw['recall']:.3f} F1={raw['f1']:.3f} falseTrig={raw['false_trig']:.3f} | "
              f"PROD R={prod['recall']:.3f} skip={prod['skip']:.1%} | {cfg}")
    if not a.sweep:
        print("\nPer video (current config):")
        for name, v in vids.items():
            config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = saved
            r = run([v], "raw"); config.MOTION_GATE_GRACE_SECONDS, config.MOTION_GATE_FORCE_INTERVAL_SECONDS = saved
            p = run([v], "prod")
            print(f"  {name:38s} RAW P={r['precision']:.2f} R={r['recall']:.2f} | PROD R={p['recall']:.2f} skip={p['skip']:.0%}")


if __name__ == "__main__":
    main()
