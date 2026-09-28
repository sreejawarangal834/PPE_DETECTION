"""Unit tests for motion_gate.py — the person->motion->PPE cascade's second
stage. Hermetic: synthetic numpy frames only, no real video/model involved."""

from __future__ import annotations

import time as time_module

import numpy as np

import config
import motion_gate


def _checkerboard(size=200, seed=0):
    rng = np.random.default_rng(seed)
    return rng.integers(0, 255, (size, size, 3), dtype=np.uint8)


def test_identical_frames_not_flagged_as_motion(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    state = motion_gate.new_session_state()
    frame = _checkerboard()

    motion_gate._compute_motion_mask(frame, state)  # first call: establishes prev_gray
    mask = motion_gate._compute_motion_mask(frame, state)  # identical frame -> no diff

    assert mask is not None
    fraction = motion_gate._box_motion_fraction(mask, (0, 0, 200, 200))
    assert fraction == 0.0


def test_changed_region_flagged_as_motion_but_not_elsewhere(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    state = motion_gate.new_session_state()
    frame1 = np.zeros((200, 200, 3), dtype=np.uint8)
    frame2 = frame1.copy()
    frame2[50:100, 50:100] = 255  # a clearly changed rectangle

    motion_gate._compute_motion_mask(frame1, state)
    mask = motion_gate._compute_motion_mask(frame2, state)

    assert mask is not None
    changed_box_fraction = motion_gate._box_motion_fraction(mask, (50, 50, 100, 100))
    untouched_box_fraction = motion_gate._box_motion_fraction(mask, (150, 150, 190, 190))
    assert changed_box_fraction > 0.9
    assert untouched_box_fraction == 0.0


def test_should_run_inference_true_when_any_candidate_box_moves(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    monkeypatch.setattr(config, "MOTION_MIN_FRACTION", 0.02)
    state = motion_gate.new_session_state()
    frame1 = np.zeros((200, 200, 3), dtype=np.uint8)
    frame2 = frame1.copy()
    frame2[50:100, 50:100] = 255

    motion_gate.should_run_inference(state, frame1, [(50, 50, 100, 100)])  # warm up prev_gray
    result = motion_gate.should_run_inference(
        state, frame2, [(150, 150, 190, 190), (50, 50, 100, 100)],  # second box overlaps the change
    )

    assert result is True


def test_should_run_inference_false_when_no_candidate_box_moves(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    monkeypatch.setattr(config, "MOTION_MIN_FRACTION", 0.02)
    monkeypatch.setattr(config, "MOTION_GATE_GRACE_SECONDS", 0.0)
    monkeypatch.setattr(config, "MOTION_GATE_FORCE_INTERVAL_SECONDS", 999.0)
    state = motion_gate.new_session_state()
    frame1 = np.zeros((200, 200, 3), dtype=np.uint8)
    frame2 = frame1.copy()
    frame2[50:100, 50:100] = 255  # motion happens, but only OUTSIDE every candidate box

    motion_gate.should_run_inference(state, frame1, [(150, 150, 190, 190)])
    result = motion_gate.should_run_inference(state, frame2, [(150, 150, 190, 190)])

    assert result is False


def test_grace_window_covers_brief_stillness_after_motion(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    monkeypatch.setattr(config, "MOTION_MIN_FRACTION", 0.02)
    monkeypatch.setattr(config, "MOTION_GATE_GRACE_SECONDS", 5.0)
    monkeypatch.setattr(config, "MOTION_GATE_FORCE_INTERVAL_SECONDS", 999.0)

    fake_now = [1000.0]
    monkeypatch.setattr(time_module, "monotonic", lambda: fake_now[0])

    state = motion_gate.new_session_state()
    frame1 = np.zeros((200, 200, 3), dtype=np.uint8)
    frame_moved = frame1.copy()
    frame_moved[50:100, 50:100] = 255
    box = (50, 50, 100, 100)

    motion_gate.should_run_inference(state, frame1, [box])
    assert motion_gate.should_run_inference(state, frame_moved, [box]) is True  # real motion

    fake_now[0] += 2.0  # still frame, but within the grace window
    assert motion_gate.should_run_inference(state, frame1, [box]) is True


def test_force_interval_fires_once_then_returns_to_false(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    monkeypatch.setattr(config, "MOTION_MIN_FRACTION", 0.02)
    monkeypatch.setattr(config, "MOTION_GATE_GRACE_SECONDS", 5.0)
    monkeypatch.setattr(config, "MOTION_GATE_FORCE_INTERVAL_SECONDS", 2.0)

    fake_now = [1000.0]
    monkeypatch.setattr(time_module, "monotonic", lambda: fake_now[0])

    state = motion_gate.new_session_state()
    frame1 = np.zeros((200, 200, 3), dtype=np.uint8)
    frame_moved = frame1.copy()
    frame_moved[50:100, 50:100] = 255
    box = (50, 50, 100, 100)

    motion_gate.should_run_inference(state, frame1, [box])       # establishes prev_gray = frame1
    motion_gate.should_run_inference(state, frame_moved, [box])  # real motion; last_motion_at = last_forced_run_at = 1000.0

    # Keep feeding the SAME still frame from now on -> no further frame-to-frame diff.
    fake_now[0] = 1005.1  # past the 5.0s grace window (1000.0 + 5.0 = 1005.0)
    assert motion_gate.should_run_inference(state, frame_moved, [box]) is True  # force valve fires

    fake_now[0] = 1005.2  # immediately after — force valve just reset at 1005.1
    assert motion_gate.should_run_inference(state, frame_moved, [box]) is False


def test_warmup_fails_open(monkeypatch):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 5)
    state = motion_gate.new_session_state()
    frame = _checkerboard()

    assert motion_gate.should_run_inference(state, frame, [(0, 0, 50, 50)]) is True


def test_fails_open_on_internal_exception(monkeypatch):
    def _raise(frame, state):
        raise RuntimeError("boom")

    monkeypatch.setattr(motion_gate, "_compute_motion_mask", _raise)
    state = motion_gate.new_session_state()
    frame = _checkerboard()

    assert motion_gate.should_run_inference(state, frame, [(0, 0, 50, 50)]) is True


def test_no_candidate_boxes_returns_false():
    state = motion_gate.new_session_state()
    frame = _checkerboard()

    assert motion_gate.should_run_inference(state, frame, []) is False


# ── Long-timescale static-object presumption ──────────────────────────────


def _static_scene_setup(monkeypatch, fake_now):
    monkeypatch.setattr(config, "MOTION_WARMUP_FRAMES", 0)
    monkeypatch.setattr(config, "MOTION_MIN_FRACTION", 0.02)
    monkeypatch.setattr(config, "MOTION_GATE_GRACE_SECONDS", 0.0)
    monkeypatch.setattr(config, "MOTION_GATE_FORCE_INTERVAL_SECONDS", 9999.0)  # isolate the static-region logic
    monkeypatch.setattr(config, "MOTION_STATIC_OBJECT_SECONDS", 300.0)
    monkeypatch.setattr(config, "MOTION_STATIC_REVERIFY_SECONDS", 600.0)
    monkeypatch.setattr(time_module, "monotonic", lambda: fake_now[0])


def test_static_candidate_excluded_only_after_the_static_object_threshold(monkeypatch):
    fake_now = [1000.0]
    _static_scene_setup(monkeypatch, fake_now)
    state = motion_gate.new_session_state()
    frame = np.zeros((200, 200, 3), dtype=np.uint8)  # a mannequin: the SAME frame, forever
    box = (50, 50, 100, 100)

    fake_now[0] = 1000.1
    motion_gate.should_run_inference(state, frame, [box])  # warm up prev_gray (mask=None, no region yet)

    fake_now[0] = 1000.2  # first real comparison -> region created here, still_since = 1000.2
    assert motion_gate.should_run_inference(state, frame, [box]) is False
    region = state.static_regions[0]
    assert (fake_now[0] - region.still_since) < config.MOTION_STATIC_OBJECT_SECONDS

    fake_now[0] = 1000.2 + 100.0  # 100s continuously still — not yet past the 300s threshold
    assert motion_gate.should_run_inference(state, frame, [box]) is False  # still a normal "no motion" rejection...
    assert (fake_now[0] - region.still_since) < config.MOTION_STATIC_OBJECT_SECONDS

    fake_now[0] = 1000.2 + 301.0  # now past 300s continuously still
    assert motion_gate.should_run_inference(state, frame, [box]) is False  # ...now excluded as presumed non-human
    assert (fake_now[0] - region.still_since) >= config.MOTION_STATIC_OBJECT_SECONDS


def test_static_candidate_is_reverified_after_the_reverify_interval(monkeypatch):
    fake_now = [1000.0]
    _static_scene_setup(monkeypatch, fake_now)
    state = motion_gate.new_session_state()
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    box = (50, 50, 100, 100)

    fake_now[0] = 1000.1
    motion_gate.should_run_inference(state, frame, [box])  # warm up

    fake_now[0] = 1000.2  # region created, still_since = 1000.2
    motion_gate.should_run_inference(state, frame, [box])
    region = state.static_regions[0]
    first_reverify = region.last_reverified_at  # == 1000.2

    fake_now[0] = 1000.2 + 301.0  # confirmed static, but reverify window (600s) not elapsed yet
    motion_gate.should_run_inference(state, frame, [box])
    assert region.last_reverified_at == first_reverify

    fake_now[0] = 1000.2 + 601.0  # MOTION_STATIC_REVERIFY_SECONDS elapsed since last_reverified_at
    motion_gate.should_run_inference(state, frame, [box])
    assert region.last_reverified_at == fake_now[0]
    assert region.last_reverified_at != first_reverify


def test_static_region_resets_and_resumes_normal_tracking_once_it_moves(monkeypatch):
    fake_now = [1000.0]
    _static_scene_setup(monkeypatch, fake_now)
    state = motion_gate.new_session_state()
    frame_still = np.zeros((200, 200, 3), dtype=np.uint8)
    frame_moving = frame_still.copy()
    frame_moving[50:100, 50:100] = 255
    box = (50, 50, 100, 100)

    fake_now[0] = 1000.1
    motion_gate.should_run_inference(state, frame_still, [box])  # warm up

    fake_now[0] = 1000.2  # region created, still_since = 1000.2
    motion_gate.should_run_inference(state, frame_still, [box])
    region = state.static_regions[0]

    fake_now[0] = 1000.2 + 301.0  # confirmed static
    motion_gate.should_run_inference(state, frame_still, [box])
    assert (fake_now[0] - region.still_since) >= config.MOTION_STATIC_OBJECT_SECONDS

    fake_now[0] = 1000.2 + 302.0  # a real person now stands here (motion detected)
    result = motion_gate.should_run_inference(state, frame_moving, [box])
    assert result is True
    assert region.still_since == fake_now[0]  # the "still since" clock resets on detected motion


def test_all_candidates_static_goes_quiet_without_waiting_for_force_valve(monkeypatch):
    fake_now = [1000.0]
    _static_scene_setup(monkeypatch, fake_now)
    state = motion_gate.new_session_state()
    frame = np.zeros((200, 200, 3), dtype=np.uint8)  # a scene that is ENTIRELY mannequins
    boxes = [(10, 10, 40, 40), (60, 60, 90, 90)]

    fake_now[0] = 1000.1
    motion_gate.should_run_inference(state, frame, boxes)  # warm up

    fake_now[0] = 1000.2  # both regions created
    motion_gate.should_run_inference(state, frame, boxes)

    fake_now[0] = 1000.2 + 301.0  # both confirmed static; reverify window (600s) not due yet
    result = motion_gate.should_run_inference(state, frame, boxes)

    assert result is False
    assert len(state.static_regions) == 2
