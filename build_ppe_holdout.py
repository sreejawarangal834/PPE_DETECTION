"""Build datasets/ppe_holdout/ — a deduplicated, held-out helmet/vest/person/gloves/shoe eval set for the
13-class PPE taxonomy, from an external Roboflow-100 dataset. Near-duplicates of ANY image in the training pools
are removed (64-bit dHash, Hamming <= HAM), then the rest is split by near-duplicate cluster into
  tuneval  (used as the objective for hyperparameter search)   and
  test     (never touched by tuning; final report only).
Source classes helmet/no-helmet/no-vest/person/vest map 1:1 onto the 13-class taxonomy.
"""
import glob, os, random, shutil
from multiprocessing import Pool
from pathlib import Path
import cv2
import numpy as np

R = Path("/home/innovision-limited/usecase-3/datasets")
SRC = R / "ext_construction_safety_gsnvb"  # Roboflow-100 construction-safety (HF: LibreYOLO/construction-safety-gsnvb)
OUT = R / "ppe_holdout"
HAM = 8
NAMES = ['gloves', 'goggles', 'helmet', 'mask', 'no-gloves', 'no-goggles', 'no-helmet', 'no-mask', 'no-shoe', 'no-vest', 'person', 'shoe', 'vest']
MAP = {0: "helmet", 1: "no-helmet", 2: "no-vest", 3: "person", 4: "vest"}  # source class ids
POOLS = [R / "SH17_13class/images"] + [R / f"merged_ppe_dataset_{v}/images" for v in ("v3", "v5", "v6", "v7", "v8", "v9", "v11")] + \
        [R / "custom_dataset_v2/merged_ppe_dataset_resplit_resplit"]


def dhash(p):
    im = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
    if im is None:
        return None
    s = cv2.resize(im, (9, 8), interpolation=cv2.INTER_AREA)
    bits = (s[:, 1:] > s[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def imgs(d):
    return [p for p in glob.glob(str(d) + "/**/*", recursive=True) if p.lower().endswith((".jpg", ".jpeg", ".png"))]


if __name__ == "__main__":
    ref_paths = [p for d in POOLS if d.exists() for p in imgs(d)]
    print("reference images:", len(ref_paths))
    with Pool(12) as pool:
        ref = np.array([h for h in pool.map(dhash, ref_paths, chunksize=256) if h is not None], dtype=np.uint64)
        cand_paths = [Path(p) for p in imgs(SRC)]
        ch = pool.map(dhash, cand_paths)
    ref = np.unique(ref)
    tab = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)
    keep = []
    for p, h in zip(cand_paths, ch):
        if h is None:
            continue
        d = tab[np.bitwise_xor(ref, np.uint64(h)).view(np.uint8)].reshape(-1, 8).sum(1)
        if d.min() > HAM:
            keep.append((p, h))
    print(f"candidates {len(cand_paths)} -> {len(keep)} after removing near-dups of training pools")

    # cluster near-duplicates inside the candidates (union-find)
    par = list(range(len(keep)))
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    hs = [h for _, h in keep]
    for i in range(len(keep)):
        for j in range(i + 1, len(keep)):
            if bin(hs[i] ^ hs[j]).count("1") <= HAM:
                par[find(i)] = find(j)
    cl = {}
    for i in range(len(keep)):
        cl.setdefault(find(i), []).append(i)
    ids = sorted(cl, key=lambda k: (-len(cl[k]), k))
    random.seed(0)
    total = len(keep); cnt = {"tuneval": 0, "test": 0}
    tgt = {"tuneval": 0.65, "test": 0.35}
    if OUT.exists():
        shutil.rmtree(OUT)
    stats = {s: [0, 0] for s in tgt}
    for k in ids:
        s = max(tgt, key=lambda x: tgt[x] * total - cnt[x])
        cnt[s] += len(cl[k])
        for i in cl[k]:
            p = keep[i][0]
            lab = p.parent.parent / "labels" / (p.stem + ".txt")
            lines = []
            if lab.exists():
                for ln in lab.read_text().splitlines():
                    t = ln.split()
                    if len(t) >= 5 and int(float(t[0])) in MAP:
                        lines.append(" ".join([str(NAMES.index(MAP[int(float(t[0]))]))] + t[1:]))
            (OUT / s / "images").mkdir(parents=True, exist_ok=True); (OUT / s / "labels").mkdir(parents=True, exist_ok=True)
            stem = f"cv2_{p.parent.parent.name}_{p.stem[:60]}"
            shutil.copy2(p, OUT / s / "images" / (stem + p.suffix.lower()))
            (OUT / s / "labels" / (stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))
            stats[s][0] += 1; stats[s][1] += len(lines)
    for s in [x for x in tgt if (OUT / x).exists()]:
        (OUT / f"{s}.yaml").write_text(f"path: {OUT}\ntrain: {s}/images\nval: {s}/images\nnames: {NAMES}\n")
    print({s: f"{n} images, {b} boxes" for s, (n, b) in stats.items()})
