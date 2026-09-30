"""Build datasets/person_mannequin/ (YOLO format, 2 classes: 0 person, 1 mannequin).

Sources
  mannequin.v1i.yolo26          employee+person -> person, mannequin -> mannequin
  Mannequin.v1i.yolo26 (1)      mannequin only (top-level train/valid/test only; nested copies ignored)
  thermal/YOLOv5 Data           mannequin boxes (thermal fall videos); 'animal' dropped
  SBU-shadow (1)                PSEUDO-labelled: COCO yolo26m persons (conf>=HI) -> person; images whose
                                best detection falls in the ambiguous band [LO,HI) are dropped; images with
                                no detection at all are kept as shadow hard negatives (capped)
  archive (2)                   PSEUDO-labelled: COCO 'person' boxes on mannequin close-ups -> mannequin
Splits are by source video/group (greedy, size-balanced) so consecutive frames never straddle splits;
byte-identical images across sources are dropped.
"""
from __future__ import annotations
import hashlib, random, re, shutil, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path("/home/innovision-limited/usecase-3/datasets")
OUT = ROOT / "person_mannequin"
PSEUDO_MODEL = "/home/innovision-limited/usecase-3/yolo26m.pt"
HI, LO = 0.5, 0.2
SBU_POS_MAX, SBU_NEG_MAX = 1500, 500
IMG = {".jpg", ".jpeg", ".png"}
random.seed(0)


def read_yolo(p: Path, remap: dict[int, int]) -> list[str]:
    out = []
    if p.exists():
        for ln in p.read_text().splitlines():
            t = ln.split()
            if len(t) >= 5 and int(float(t[0])) in remap:
                out.append(" ".join([str(remap[int(float(t[0]))])] + t[1:5]))
    return out


def group_key(source: str, name: str) -> str:
    b = re.split(r"_jpg|_png|\.rf\.", name)[0]
    return f"{source}:" + re.sub(r"_\d+$", "", b)


items = []  # (source, group, img_path, [label lines])

# 1. mannequin.v1i.yolo26  (0 employee, 1 mannequin, 2 person)
d = ROOT / "mannequin.v1i.yolo26"
for f in sorted((d / "train/images").iterdir()):
    if f.suffix.lower() in IMG:
        items.append(("mq3", group_key("mq3", f.name), f, read_yolo(d / "train/labels" / (f.stem + ".txt"), {0: 0, 1: 1, 2: 0})))

# 2. Mannequin.v1i.yolo26 (1)  (0 mannequin) top-level splits only
d = ROOT / "Mannequin.v1i.yolo26 (1)"
for s in ("train", "valid", "test"):
    for f in sorted((d / s / "images").iterdir()):
        if f.suffix.lower() in IMG:
            items.append(("mq1", group_key("mq1", f.name), f, read_yolo(d / s / "labels" / (f.stem + ".txt"), {0: 1})))

# 3. thermal mannequin frames (annotation classes person0/animal1/mannequin2)
d = ROOT / "thermal/YOLOv5 Data"
for fold in sorted((d / "mannequin_frames").iterdir()):
    for f in sorted(fold.iterdir()):
        if f.suffix.lower() in IMG:
            lab = read_yolo(d / "mannequin_annotations" / fold.name / (f.stem + ".txt"), {0: 0, 2: 1})
            items.append(("thermal", f"thermal:{fold.name}", f, lab))

# 4/5. pseudo-labelled sources
from ultralytics import YOLO
m = YOLO(PSEUDO_MODEL)


def coco_persons(paths, chunk=16):
    for i in range(0, len(paths), chunk):
        for r in m.predict([str(p) for p in paths[i:i + chunk]], classes=[0], conf=LO, imgsz=960, verbose=False):
            yield [(float(b.conf[0]), *(b.xywhn[0].tolist())) for b in r.boxes]


d = ROOT / "archive (2)"
arch = sorted(p for p in d.rglob("*") if p.suffix.lower() in IMG)
kept = 0
for p, dets in zip(arch, coco_persons(arch)):
    dets = [x for x in dets if x[0] >= 0.25]
    if dets:
        dets = [max(dets, key=lambda x: x[3] * x[4])]  # close-ups: one mannequin per image, the largest
        items.append(("archive2", "archive2:all", p, [f"1 {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for _, x, y, w, h in dets]))
        kept += 1
print(f"archive(2): {kept}/{len(arch)} images auto-boxed as mannequin")

d = ROOT / "SBU-shadow (1)/SBU-shadow"
sbu = sorted(p for p in d.rglob("ShadowImages/*") if p.suffix.lower() in IMG)
random.shuffle(sbu)
pos, neg = [], []
for p, dets in zip(sbu, coco_persons(sbu)):
    if len(pos) >= SBU_POS_MAX and len(neg) >= SBU_NEG_MAX:
        break
    if not dets:
        if len(neg) < SBU_NEG_MAX:
            neg.append((p, []))
    elif max(x[0] for x in dets) >= HI:
        if len(pos) < SBU_POS_MAX:
            pos.append((p, [f"0 {x:.6f} {y:.6f} {w:.6f} {h:.6f}" for c, x, y, w, h in dets if c >= HI]))
    # else ambiguous band -> dropped
    # (persons < HI in an image that also has a >=HI person stay unlabelled: acceptable noise)
for i, (p, lab) in enumerate(pos + neg):
    items.append(("sbu", f"sbu:{i // 40}", p, lab))  # SBU images are unrelated stills; chunk groups only for balance
print(f"SBU: {len(pos)} pseudo-labelled positives, {len(neg)} negatives")

# dedupe by bytes
seen, uniq = set(), []
for it in items:
    h = hashlib.md5(it[2].read_bytes()).hexdigest()
    if h not in seen:
        seen.add(h); uniq.append(it)
print(f"{len(items)} items -> {len(uniq)} after dedupe")

# greedy size-balanced group split, done PER SOURCE so every split sees every source
targets = {"train": 0.8, "val": 0.1, "test": 0.1}
by_src = defaultdict(lambda: defaultdict(list))
for it in uniq:
    by_src[it[0]][it[1]].append(it)
groups, assign = defaultdict(list), {}
for src, gs in by_src.items():
    n = sum(len(v) for v in gs.values())
    count = {k: 0 for k in targets}
    order = sorted(gs, key=lambda g: (-len(gs[g]), g))
    for g in order:
        s_ = max(targets, key=lambda k: targets[k] * n - count[k])
        assign[g] = s_; count[s_] += len(gs[g]); groups[g] = gs[g]

if OUT.exists():
    shutil.rmtree(OUT)
stats = {s: [0, 0, 0] for s in targets}
for g, its in groups.items():
    s = assign[g]
    for src, _, p, lab in its:
        stem = f"{src}_{hashlib.md5(str(p).encode()).hexdigest()[:10]}"
        (OUT / s / "images").mkdir(parents=True, exist_ok=True); (OUT / s / "labels").mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, OUT / s / "images" / (stem + p.suffix.lower()))
        (OUT / s / "labels" / (stem + ".txt")).write_text("\n".join(lab) + ("\n" if lab else ""))
        stats[s][0] += 1
        for ln in lab:
            stats[s][1 + int(ln.split()[0])] += 1
(OUT / "data.yaml").write_text(f"path: {OUT}\ntrain: train/images\nval: val/images\ntest: test/images\nnc: 2\nnames: ['person', 'mannequin']\n")
for s, (n, a, b) in stats.items():
    print(f"{s}: {n} images, person boxes={a}, mannequin boxes={b}")
