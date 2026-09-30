"""Unit tests for mannequin_gate.py — hermetic (no model weights): pure geometry/masking helpers,
plus detect() with a fake model."""

from __future__ import annotations

import numpy as np

import config
import mannequin_gate


def test_resolve_keeps_higher_confidence_label_for_same_object():
    box = (10, 10, 50, 100)
    persons, mannequins = mannequin_gate.resolve([(box, 0.9)], [(box, 0.4)])
    assert persons == [box] and mannequins == []
    persons, mannequins = mannequin_gate.resolve([(box, 0.3)], [(box, 0.8)])
    assert persons == [] and mannequins == [box]


def test_resolve_keeps_both_when_objects_differ():
    p, m = (0, 0, 40, 100), (200, 0, 240, 100)
    persons, mannequins = mannequin_gate.resolve([(p, 0.9)], [(m, 0.9)])
    assert persons == [p] and mannequins == [m]


def test_exclusion_skips_mannequin_covered_by_a_real_person():
    mannequin = (100, 100, 160, 260)
    person_in_front = (90, 90, 170, 270)
    assert mannequin_gate.exclusion_regions([mannequin], [person_in_front]) == []
    assert mannequin_gate.exclusion_regions([mannequin], [(400, 0, 460, 160)]) == [mannequin]
    assert mannequin_gate.exclusion_regions([mannequin], []) == [mannequin]


def test_mask_regions_paints_only_the_region_and_does_not_mutate_input(monkeypatch):
    monkeypatch.setattr(config, "MANNEQUIN_MASK_PAD_PX", 0)
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    frame[:, :] = 200
    frame[20:40, 20:40] = 10
    out = mannequin_gate.mask_regions(frame, [(20, 20, 40, 40)])
    assert out is not frame
    assert (frame[20:40, 20:40] == 10).all()          # input untouched
    assert (out[20:40, 20:40] != 10).all()             # region painted over
    assert (out[60:80, 60:80] == 200).all()            # elsewhere untouched


def test_mask_regions_returns_same_frame_when_nothing_to_mask():
    frame = np.zeros((10, 10, 3), dtype=np.uint8)
    assert mannequin_gate.mask_regions(frame, []) is frame


def test_drop_in_regions_removes_detections_centred_on_a_mannequin():
    dets = [{"label": "person", "box": [0.10, 0.10, 0.30, 0.90]},   # on the mannequin
            {"label": "helmet", "box": [0.15, 0.10, 0.25, 0.20]},   # helmet on mannequin head
            {"label": "person", "box": [0.60, 0.10, 0.80, 0.90]}]   # real worker elsewhere
    kept = mannequin_gate.drop_in_regions(dets, [(100, 100, 300, 900)], 1000, 1000)
    assert [d["box"][0] for d in kept] == [0.60]


class _Arr(list):
    def tolist(self):
        return list(self)


class _Box:
    def __init__(self, xyxy, conf, cls):
        self.xyxy, self.conf, self.cls = [_Arr(xyxy)], [conf], [cls]


class _Model:
    names = {0: "person", 1: "mannequin"}

    def __init__(self, boxes):
        self._boxes = boxes

    def predict(self, *a, **k):
        return [type("R", (), {"boxes": self._boxes})()]


def test_detect_splits_classes_and_applies_mannequin_conf(monkeypatch):
    monkeypatch.setattr(config, "MANNEQUIN_CONF_THRESHOLD", 0.5)
    boxes = [_Box((0, 0, 10, 40), 0.9, 0), _Box((100, 0, 110, 40), 0.8, 1), _Box((200, 0, 210, 40), 0.3, 1)]
    monkeypatch.setattr(mannequin_gate, "_get_thread_model", lambda: _Model(boxes))
    mannequin_gate._thread_local.names = {"person": 0, "mannequin": 1}
    persons, mannequins = mannequin_gate.detect(np.zeros((10, 10, 3), dtype=np.uint8))
    assert persons == [(0, 0, 10, 40)] and mannequins == [(100, 0, 110, 40)]


def test_detect_fails_open_on_exception(monkeypatch):
    def boom():
        raise RuntimeError("x")

    monkeypatch.setattr(mannequin_gate, "_get_thread_model", boom)
    assert mannequin_gate.detect(np.zeros((10, 10, 3), dtype=np.uint8)) is None


def test_enabled_false_when_weights_missing(monkeypatch):
    monkeypatch.setattr(config, "PERSON_MANNEQUIN_MODEL", "/nonexistent/x.pt")
    assert mannequin_gate.enabled() is False
