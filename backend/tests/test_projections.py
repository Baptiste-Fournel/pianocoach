from datetime import date, timedelta

from app.services import projections as pj


def _piece(title, order, status="planned", diff=5, progress=0, track="chopin"):
    return pj.PieceLike(title=title, track=track, status=status, difficulty=diff,
                        progress_pct=progress, order_index=order)


def test_estimate_piece_hours_scales_with_difficulty_and_progress():
    assert pj.estimate_piece_hours(5, 0) == 5 * pj.HOURS_PER_DIFFICULTY
    # Halfway done => half the hours.
    assert pj.estimate_piece_hours(5, 50) == 0.5 * 5 * pj.HOURS_PER_DIFFICULTY
    # Finished => zero.
    assert pj.estimate_piece_hours(8, 100) == 0.0
    # Missing difficulty falls back to the default.
    assert pj.estimate_piece_hours(None, 0) == pj.DEFAULT_DIFFICULTY * pj.HOURS_PER_DIFFICULTY


def test_weekly_practice_hours_none_without_data():
    ref = date(2026, 6, 29)
    assert pj.weekly_practice_hours([], reference_date=ref) is None


def test_weekly_practice_hours_averages_recent_weeks():
    ref = date(2026, 6, 29)
    # 4 sessions of 60 min within the last 4 weeks => 4h / 4 weeks = 1h/week.
    sessions = [pj.SessionLike(date=ref - timedelta(days=d), duration_min=60)
                for d in (1, 8, 15, 22)]
    assert pj.weekly_practice_hours(sessions, reference_date=ref, weeks=4) == 1.0


def test_consistency_factor_bounds():
    ref = date(2026, 6, 29)
    assert pj.consistency_factor([], reference_date=ref) == 0.5
    every_day = [pj.SessionLike(date=ref - timedelta(days=d), duration_min=30) for d in range(28)]
    assert pj.consistency_factor(every_day, reference_date=ref, window_days=28) == 1.0


def test_project_target_counts_only_remaining_rungs():
    ref = date(2026, 6, 29)
    pieces = [
        _piece("rung1", 0, status="learned", diff=4),   # learned -> excluded
        _piece("rung2", 1, status="in_progress", diff=4, progress=50),
        _piece("TARGET", 2, status="target", diff=9, progress=0),
    ]
    target = pieces[-1]
    sessions = [pj.SessionLike(date=ref - timedelta(days=d), duration_min=120) for d in (1, 3, 5, 7)]
    proj = pj.project_target(target, pieces, sessions, reference_date=ref)
    # Two rungs remain (rung2 half-done + target).
    assert len(proj.rungs) == 2
    expected_hours = pj.estimate_piece_hours(4, 50) + pj.estimate_piece_hours(9, 0)
    assert abs(proj.remaining_hours - expected_hours) < 1e-6
    assert proj.weeks_low <= proj.weeks_remaining <= proj.weeks_high
    assert proj.eta_date is not None


def test_project_target_uses_fallback_without_sessions():
    ref = date(2026, 6, 29)
    pieces = [_piece("TARGET", 0, status="target", diff=9)]
    proj = pj.project_target(pieces[0], pieces, [], reference_date=ref)
    assert proj.weekly_hours == pj.FALLBACK_WEEKLY_HOURS
    assert proj.to_dict()["months_remaining"] > 0


def test_sparse_data_does_not_explode_eta():
    # A single short session must not collapse the weekly rate (regression):
    # the measured 0.3 h/week is blended toward the conservative prior.
    ref = date(2026, 6, 29)
    pieces = [_piece("TARGET", 0, status="target", diff=9, progress=0)]
    sessions = [pj.SessionLike(date=ref, duration_min=75)]  # one 75-min session
    proj = pj.project_target(pieces[0], pieces, sessions, reference_date=ref)
    # With 1 practiced day, confidence = 1/8: weekly stays close to the 7h prior.
    assert proj.weekly_hours > 5.0
    # Fantaisie-level (diff 9 ≈ 81h) at ~6h/week is months, not decades.
    assert proj.to_dict()["months_remaining"] < 12
