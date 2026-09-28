"""Unit tests for person_gate.py's presence gate — hermetic: the thread-local
YOLO model getter is monkeypatched, so no real model weights are loaded."""

from __future__ import annotations

import numpy as np

import person_gate


class _FakeResult:
    def __init__(self, boxes):
        self.boxes = boxes


class _FakeModel:
    def __init__(self, boxes):
        self._boxes = boxes

    def predict(self, *args, **kwargs):
        return [_FakeResult(self._boxes)]


def test_has_person_true_when_boxes_present(monkeypatch):
    monkeypatch.setattr(person_gate, "_get_thread_model", lambda: _FakeModel([object()]))
    frame = np.zeros((10, 10, 3), dtype=np.uint8)
    assert person_gate.has_person(frame) is True


def test_has_person_false_when_no_boxes(monkeypatch):
    monkeypatch.setattr(person_gate, "_get_thread_model", lambda: _FakeModel([]))
    frame = np.zeros((10, 10, 3), dtype=np.uint8)
    assert person_gate.has_person(frame) is False


def test_has_person_fails_open_on_exception(monkeypatch):
    """A broken gate must never silently disable real PPE detection — it
    should default to True (run inference) rather than False (skip it)."""

    def _raise():
        raise RuntimeError("model load failed")

    monkeypatch.setattr(person_gate, "_get_thread_model", _raise)
    frame = np.zeros((10, 10, 3), dtype=np.uint8)
    assert person_gate.has_person(frame) is True
