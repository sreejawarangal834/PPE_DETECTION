import sys; sys.path.insert(0, ".")
import compliance as c

def worker(x0, tid0, items, with_ids=True):
    """one worker at horizontal offset x0; items = set of PPE labels worn"""
    W = 0.25
    boxes = {
      "person": [x0, .10, x0+W, .95],
      "head":   [x0+.08, .10, x0+.17, .22],
      "hands":  [x0+.02, .50, x0+.08, .58],
      "foot":   [x0+.08, .88, x0+.18, .95],
      "face":   [x0+.09, .13, x0+.16, .20],
      "helmet": [x0+.07, .08, x0+.18, .20],
      "gloves": [x0+.01, .49, x0+.09, .59],
      "shoes":  [x0+.07, .87, x0+.19, .96],
      "safety-vest": [x0+.04, .28, x0+.21, .55],
      "glasses": [x0+.09, .13, x0+.16, .17],
      "face-mask-medical": [x0+.09, .16, x0+.16, .21],
    }
    out = []
    labels = ["person","head","hands","foot","face"] + [i for i in items]
    for k, l in enumerate(labels):
        out.append({"label": l, "conf": .8, "box": boxes[l], "_track_id": (tid0+k) if with_ids else None})
    return out

def run(dets_fn, frames=40, required=None):
    st = c.new_session_state(); t = 0.0; all_wv = []
    for _ in range(frames):
        t += .1
        d = dets_fn()
        sev, vio, wv = c.evaluate_compliance(d, st, t, required_ppe=required)
        all_wv += wv          # new-raise events only appear on the transition frame
    return sev, vio, all_wv, d

full = ["helmet","gloves","shoes","safety-vest","glasses","face-mask-medical"]

# 1. fully equipped worker, tracker ids on  -> must be clean
sev, vio, wv, d = run(lambda: worker(.1, 10, full))
print("1 full PPE, ids on :", sev, vio, "| person compliant:", [x['compliant'] for x in d if x['label']=='person'])
assert sev == "ok" and not wv

# 2. same, ids off -> clean
sev, vio, wv, d = run(lambda: worker(.1, 10, full, with_ids=False))
print("2 full PPE, ids off:", sev, vio); assert sev == "ok"

# 3. missing helmet only -> exactly one violation, attributed to the PERSON's track id (10)
no_helmet = [i for i in full if i != "helmet"]
sev, vio, wv, d = run(lambda: worker(.1, 10, no_helmet))
print("3 no helmet        :", sev, vio, "| worker ids:", {w['worker_id'] for w in wv})
assert vio == ["no-head-protection"] and sev == "medium" and {w['worker_id'] for w in wv} == {10}
print("   person compliant:", [x['compliant'] for x in d if x['label']=='person'], "| head compliant:", [x['compliant'] for x in d if x['label']=='head'])
assert [x['compliant'] for x in d if x['label']=='person'] == [False]

# 4. two workers side by side: A fully equipped, B no vest -> only B flagged
def two():
    return worker(.05, 10, full) + worker(.55, 40, [i for i in full if i != "safety-vest"])
sev, vio, wv, d = run(two)
print("4 two workers      :", sev, vio, "| worker ids:", {w['worker_id'] for w in wv})
assert vio == ["no-safety-vest"] and {w['worker_id'] for w in wv} == {40}
pc = {round(x['box'][0],2): x['compliant'] for x in d if x['label']=='person'}
print("   person boxes (x0 -> compliant):", pc); assert pc == {0.05: True, 0.55: False}

# 5. medical mask worn: no face violation
sev, vio, wv, d = run(lambda: worker(.1, 10, full))
assert "no-face-protection" not in vio
no_mask = [i for i in full if i != "face-mask-medical"]
sev, vio, wv, d = run(lambda: worker(.1, 10, no_mask))
print("5 no mask          :", vio); assert "no-face-protection" in vio

# 6. zone policy (helmet, vest, gloves, safety_shoes): missing mask/glasses is NOT flagged
pol = frozenset({"helmet","vest","gloves","safety_shoes"})
sev, vio, wv, d = run(lambda: worker(.1, 10, [i for i in full if i not in ("glasses","face-mask-medical")]), required=pol)
print("6 policy w/o mask/eye:", sev, vio); assert sev == "ok"
print("ALL OK")
