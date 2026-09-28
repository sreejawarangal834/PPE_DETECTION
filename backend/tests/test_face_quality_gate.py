"""Unit tests for face/quality_gate.py's two-stage gate — hermetic: no
InsightFace model involved, evaluate_face() takes a duck-typed Face-like
object (it only reads .det_score / .pose, same fields the real Face object
exposes)."""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np

from face.quality_gate import QualityGate


def test_precheck_rejects_too_small_crop():
    gate = QualityGate()
    crop = np.random.randint(0, 255, (20, 20, 3), dtype=np.uint8)
    result = gate.precheck_size_blur(crop, min_face_size_px=40, blur_threshold=0.0)
    assert result.passes is False
    assert "too_small" in result.rejection_reason


def test_precheck_rejects_blurry_crop():
    gate = QualityGate()
    crop = np.full((100, 100, 3), 128, dtype=np.uint8)  # flat/uniform -> zero blur variance
    result = gate.precheck_size_blur(crop, min_face_size_px=40, blur_threshold=100.0)
    assert result.passes is False
    assert "too_blurry" in result.rejection_reason


def test_precheck_passes_sharp_large_crop():
    gate = QualityGate()
    crop = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)  # noise -> high blur variance
    result = gate.precheck_size_blur(crop, min_face_size_px=40, blur_threshold=1.0)
    assert result.passes is True


def test_evaluate_face_rejects_low_detector_confidence():
    gate = QualityGate()
    face = SimpleNamespace(det_score=0.5, pose=None)
    result = gate.evaluate_face(face, blur_score=500.0, face_size_px=100, detector_confidence_min=0.7)
    assert result.passes is False
    assert "low_confidence" in result.rejection_reason


def test_evaluate_face_rejects_extreme_yaw():
    gate = QualityGate()
    face = SimpleNamespace(det_score=0.9, pose=[60.0, 0.0, 0.0])
    result = gate.evaluate_face(face, blur_score=500.0, face_size_px=100, pose_yaw_max=45.0)
    assert result.passes is False
    assert "extreme_yaw" in result.rejection_reason


def test_evaluate_face_rejects_extreme_pitch():
    gate = QualityGate()
    face = SimpleNamespace(det_score=0.9, pose=[0.0, 40.0, 0.0])
    result = gate.evaluate_face(face, blur_score=500.0, face_size_px=100, pose_pitch_max=30.0)
    assert result.passes is False
    assert "extreme_pitch" in result.rejection_reason


def test_evaluate_face_passes_good_frontal_face():
    gate = QualityGate()
    face = SimpleNamespace(det_score=0.9, pose=[5.0, 5.0, 0.0])
    result = gate.evaluate_face(face, blur_score=500.0, face_size_px=150)
    assert result.passes is True
    assert 0.0 < result.quality_score <= 1.0
