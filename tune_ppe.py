"""Hyperparameter search for the 13-class PPE detector on the leak-free split (build_clean_split.py).
Proxy runs: YOLO26m from COCO weights, 16k one-per-cluster training images, 8 epochs, scored on a 3k
held-out-cluster val subset (data_tune_fast.yaml). Objective = Ultralytics fitness (0.1*mAP50 + 0.9*mAP50-95).
The 8%-of-pool `test` split is never used here.
    python tune_ppe.py [iterations]
Resumes automatically if runs/tune_ppe/tune/tune_results.csv exists.
"""
import sys
from ultralytics import YOLO

SPACE = {  # (min, max[, gain]) — Ultralytics genetic-search format
    "lr0": (1e-4, 3e-2), "lrf": (0.01, 0.5), "momentum": (0.85, 0.98), "weight_decay": (0.0, 1e-3),
    "warmup_epochs": (0.0, 3.0), "box": (3.0, 12.0), "cls": (0.2, 2.0), "dfl": (0.5, 3.0),
    "hsv_h": (0.0, 0.05), "hsv_s": (0.3, 0.9), "hsv_v": (0.2, 0.6),
    "degrees": (0.0, 10.0), "translate": (0.0, 0.3), "scale": (0.2, 0.9),
    "fliplr": (0.0, 0.7), "mosaic": (0.5, 1.0), "mixup": (0.0, 0.3), "erasing": (0.0, 0.5),
}

if __name__ == "__main__":
    iters = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    YOLO("/home/innovision-limited/usecase-3/yolo26m.pt").tune(
        data="/home/innovision-limited/usecase-3/datasets/clean_split/data_tune_fast.yaml",
        epochs=8, iterations=iters, imgsz=640, batch=16, workers=6, optimizer="SGD",
        space=SPACE, plots=False, save=False, val=True, project="/home/innovision-limited/usecase-3/runs/tune_ppe",
        name="tune", exist_ok=True, patience=100, close_mosaic=2,
    )
