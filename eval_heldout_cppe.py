"""Validate every trained PPE/SH17 detector on CPPE-5 (held out: 0 byte-identical overlap with the
training pools, referenced by no merge script). Classes that exist in both taxonomies are scored:
gloves, goggles (SH17: glasses), mask (SH17: face-mask-medical). GT classes without an
equivalent (Coverall, Face_Shield) are dropped. Each model family gets labels remapped to its own
class indices; mAP is averaged only over the classes present in GT (Ultralytics behaviour).
    python eval_heldout_cppe.py
"""
import csv, os, shutil, sys
from pathlib import Path
from ultralytics import YOLO

R = Path("/home/innovision-limited/usecase-3")
SRC = R / "datasets/CPPE-5-YOLO"
OUT = R / "datasets/heldout_cppe"
CPPE = {2: "gloves", 3: "goggles", 4: "mask"}
FAMILIES = {  # family -> (class name list used by those models, CPPE-class -> model-class-name)
    "ppe13": {"gloves": "gloves", "goggles": "goggles", "mask": "mask"},
    "sh17": {"gloves": "gloves", "goggles": "glasses", "mask": "face-mask-medical"},
}

MODELS = {  # label -> weights
    "yolo26m_ppe_full (Jul21)": "runs/detect/runs/detect/yolo26m_ppe_full/weights/best.pt",
    "yolo26m_ppe_full epoch50": "runs/detect/runs/detect/yolo26m_ppe_full/weights/epoch50.pt",
    "yolo26s_ppe_v11": "runs/detect/runs/detect/yolo26s_ppe_v11/weights/best.pt",
    "yolo26m_ppe_v11": "dashboard/runs/detect/runs/detect/yolo26m_ppe_v11/weights/best.pt",
    "yolo26m_ppe_v9_finetune": "runs/detect/runs/detect/yolo26m_ppe_v9_finetune/weights/best.pt",
    "combined_v3_v9_sh17_yolo26m-2": "runs/detect/runs/detect/combined_v3_v9_sh17_yolo26m-2/weights/best.pt",
    "scratch_combined_v3_v9 (ep14)": "dashboard/runs/detect/runs/detect/scratch_yolo26m_combined_v3_v9/weights/best.pt",
    "scratch_combined_v3_v9_b12 (Sep29)": "dashboard/runs/detect/runs/detect/scratch_yolo26m_combined_v3_v9_b12/weights/best.pt",
    "sh17_yolo26m": "runs/detect/runs/detect/sh17_yolo26m/weights/best.pt",
    "sh17_yolo26m_100ep": "runs/detect/runs/detect/sh17_yolo26m_100ep/weights/best.pt",
    "yolo26_10ep_poc": "runs/detect/yolo26_10ep_poc/weights/best.pt",
    "yolo26_scratch_10ep": "runs/detect/yolo26_scratch_10ep/weights/best.pt",
    "backend/models/best.pt (prod, Jul18)": "dashboard/backend/models/best.pt",
}


def build(family, names):
    root = OUT / family
    if root.exists():
        shutil.rmtree(root)
    (root / "images").mkdir(parents=True); (root / "labels").mkdir(parents=True)
    n_img = n_box = 0
    for split in ("train", "val", "test"):
        for img in sorted((SRC / "images" / split).iterdir()):
            stem = f"{split}_{img.stem}"
            os.symlink(img, root / "images" / (stem + img.suffix))
            lines = []
            for ln in (SRC / "labels" / split / (img.stem + ".txt")).read_text().splitlines():
                t = ln.split()
                if int(t[0]) in CPPE:
                    lines.append(" ".join([str(names.index(FAMILIES[family][CPPE[int(t[0])]]))] + t[1:5]))
            (root / "labels" / (stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))
            n_img += 1; n_box += len(lines)
    (root / "data.yaml").write_text(f"path: {root}\ntrain: images\nval: images\nnames: {names}\n")
    return root / "data.yaml", n_img, n_box


rows, yamls = [], {}
for label, w in MODELS.items():
    wp = R / w
    if not wp.exists():
        print("MISSING", label); continue
    m = YOLO(str(wp))
    names = [m.names[i] for i in range(len(m.names))]
    fam = "sh17" if "ear-mufs" in names else "ppe13"
    if fam not in yamls:
        yamls[fam] = build(fam, names)
        print(f"{fam}: {yamls[fam][1]} images, {yamls[fam][2]} mapped boxes")
    res = m.val(data=str(yamls[fam][0]), imgsz=640, batch=16, conf=0.001, plots=False, verbose=False, workers=0)
    per = {res.names[int(c)]: float(a) for c, a in zip(res.box.ap_class_index, res.box.ap50)}
    row = {"model": label, "family": fam, "mAP50": round(float(res.box.map50), 3), "mAP50-95": round(float(res.box.map), 3)}
    for cls, mname in FAMILIES[fam].items():
        row[f"AP50_{cls}"] = round(per.get(mname, float("nan")), 3)
    rows.append(row); print(row, flush=True)

out = R / "runs/heldout_cppe_results.csv"
with open(out, "w", newline="") as f:
    wr = csv.DictWriter(f, fieldnames=list(rows[0])); wr.writeheader(); wr.writerows(rows)
print("saved", out)
