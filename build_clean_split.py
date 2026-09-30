"""Leak-free re-split of the combined_v3_v9 pool (13-class PPE).

1. dHash (64-bit) every image in SH17_13class + merged_ppe_dataset_v3..v9 (train+val dirs).
2. Union near-duplicates (Hamming <= HAM) into clusters via multi-index hashing: HAM+1 disjoint bit
   chunks => any pair within HAM bits shares >=1 chunk exactly (pigeonhole); candidates are verified.
   Degenerate buckets (> BUCKET_CAP, e.g. blank frames) are skipped rather than fully linked.
3. Split WHOLE clusters: val 8% / test 8% / train 84% (images). No cluster spans two splits.
4. tune_train: ONE image per training cluster, random N_TUNE of them (diverse, cheap proxy set).
Outputs datasets/clean_split/{train,val,test,tune_train}.txt + data yamls + split_report.txt.
Labels are found by Ultralytics via the /images/ -> /labels/ path swap (same layout as the sources).
"""
import glob, random
from collections import defaultdict
from multiprocessing import Pool
from pathlib import Path
import cv2
import numpy as np

R = Path("/home/innovision-limited/usecase-3/datasets")
OUT = R / "clean_split"
HAM, BUCKET_CAP, N_TUNE = 6, 400, 16000
NAMES = ['gloves', 'goggles', 'helmet', 'mask', 'no-gloves', 'no-goggles', 'no-helmet', 'no-mask', 'no-shoe', 'no-vest', 'person', 'shoe', 'vest']
DIRS = [R / "SH17_13class/images/train", R / "SH17_13class/images/val"] + \
       [R / f"merged_ppe_dataset_{v}/images/{s}" for v in ("v3", "v5", "v6", "v7", "v8", "v9") for s in ("train", "val")]


def dhash(p):
    im = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    if im is None:
        return 0
    s = cv2.resize(im, (9, 8), interpolation=cv2.INTER_AREA)
    return int(np.packbits((s[:, 1:] > s[:, :-1]).flatten()).view(">u8")[0])


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    paths = sorted(p for d in DIRS if d.exists() for p in glob.glob(str(d) + "/*") if p.lower().endswith((".jpg", ".jpeg", ".png")))
    paths = [p for p in paths if Path(p.replace("/images/", "/labels/")).with_suffix(".txt").exists()]
    print("images with labels:", len(paths), flush=True)
    with Pool(12) as pool:
        H = np.array(pool.map(dhash, paths, chunksize=512), dtype=np.uint64)
    n = len(paths)
    par = np.arange(n)
    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    # chunk boundaries
    nch = HAM + 1
    edges = np.linspace(0, 64, nch + 1).astype(int)
    tab = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)
    skipped = 0
    for c in range(nch):
        lo, hi = edges[c], edges[c + 1]
        key = (H >> np.uint64(lo)) & np.uint64((1 << (hi - lo)) - 1)
        order = np.argsort(key, kind="stable")
        ks = key[order]
        cuts = np.flatnonzero(np.diff(ks)) + 1
        for grp in np.split(order, cuts):
            if len(grp) < 2:
                continue
            if len(grp) > BUCKET_CAP:
                skipped += 1; continue
            hg = H[grp]
            for a in range(len(grp)):
                d = tab[np.bitwise_xor(hg[a + 1:], hg[a]).view(np.uint8)].reshape(-1, 8).sum(1)
                for b in np.flatnonzero(d <= HAM):
                    ra, rb = find(grp[a]), find(grp[a + 1 + b])
                    if ra != rb:
                        par[ra] = rb
        print(f"chunk {c + 1}/{nch} done", flush=True)
    root = np.array([find(i) for i in range(n)])
    clusters = defaultdict(list)
    for i, r in enumerate(root):
        clusters[int(r)].append(i)
    sizes = sorted((len(v) for v in clusters.values()), reverse=True)
    print(f"{len(clusters)} clusters; largest {sizes[:5]}; skipped degenerate buckets: {skipped}")

    rng = random.Random(0)
    ids = list(clusters); rng.shuffle(ids)
    tgt = {"val": 0.08, "test": 0.08, "train": 0.84}
    cnt = {k: 0 for k in tgt}; split_of = {}
    for cid in sorted(ids, key=lambda c: -len(clusters[c])):  # big clusters first, greedy to the split with most deficit
        s = max(tgt, key=lambda k: tgt[k] * n - cnt[k])
        cnt[s] += len(clusters[cid]); split_of[cid] = s
    lists = {k: [] for k in tgt}
    for cid, mem in clusters.items():
        lists[split_of[cid]] += [paths[i] for i in mem]
    train_clusters = [c for c in ids if split_of[c] == "train"]
    tune = [paths[clusters[c][rng.randrange(len(clusters[c]))]] for c in rng.sample(train_clusters, min(N_TUNE, len(train_clusters)))]
    lists["tune_train"] = tune
    for k, v in lists.items():
        (OUT / f"{k}.txt").write_text("\n".join(sorted(v)) + "\n")
    def yaml(name, train, val):
        (OUT / name).write_text(f"path: {OUT}\ntrain: {train}\nval: {val}\ntest: test.txt\nnc: 13\nnames: {NAMES}\n")
    yaml("data.yaml", "train.txt", "val.txt")
    yaml("data_tune.yaml", "tune_train.txt", "val.txt")
    rep = [f"{k}: {len(v)} images" for k, v in lists.items()] + [f"clusters={len(clusters)} largest={sizes[:5]} skipped_buckets={skipped}"]
    (OUT / "split_report.txt").write_text("\n".join(rep) + "\n"); print("\n".join(rep))
