from datetime import date, timedelta

from app.services import stats


def test_streak_empty():
    res = stats.compute_streak([], date(2026, 6, 29))
    assert res == {"current_streak": 0, "longest_streak": 0, "practiced_today": False}


def test_current_streak_counts_back_from_today():
    ref = date(2026, 6, 29)
    days = [ref, ref - timedelta(days=1), ref - timedelta(days=2)]
    res = stats.compute_streak(days, ref)
    assert res["current_streak"] == 3
    assert res["practiced_today"] is True


def test_streak_one_day_grace():
    ref = date(2026, 6, 29)
    # Practised yesterday + day before, not today: streak still alive (grace).
    days = [ref - timedelta(days=1), ref - timedelta(days=2)]
    res = stats.compute_streak(days, ref)
    assert res["current_streak"] == 2
    assert res["practiced_today"] is False


def test_longest_streak_detects_best_run():
    ref = date(2026, 6, 29)
    days = [
        date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3), date(2026, 6, 4),  # run of 4
        date(2026, 6, 10),  # isolated
    ]
    res = stats.compute_streak(days, ref)
    assert res["longest_streak"] == 4


class _S:
    def __init__(self, d, m, focus=None):
        self.date = d
        self.duration_min = m
        self.focus_areas = focus or []


def test_practice_totals_windows():
    ref = date(2026, 6, 29)
    sessions = [
        _S(ref, 60),
        _S(ref - timedelta(days=3), 30),
        _S(ref - timedelta(days=20), 90),  # in month, not week
        _S(ref - timedelta(days=60), 120),  # outside both
    ]
    totals = stats.practice_totals(sessions, ref)
    assert totals["week_min"] == 90
    assert totals["month_min"] == 180
    assert totals["total_min"] == 300


def test_focus_distribution_splits_time():
    ref = date(2026, 6, 29)
    sessions = [_S(ref, 60, ["scales", "piece"]), _S(ref, 30, ["piece"])]
    dist = {d["focus"]: d["minutes"] for d in stats.focus_distribution(sessions)}
    # 60 split across 2 => 30 each; +30 piece => piece=60, scales=30
    assert dist["piece"] == 60
    assert dist["scales"] == 30


def test_daily_minutes_length_and_aggregation():
    ref = date(2026, 6, 29)
    sessions = [_S(ref, 30), _S(ref, 20), _S(ref - timedelta(days=1), 45)]
    series = stats.daily_minutes(sessions, ref, days=7)
    assert len(series) == 7
    assert series[-1] == {"date": ref.isoformat(), "minutes": 50}
    assert series[-2]["minutes"] == 45
