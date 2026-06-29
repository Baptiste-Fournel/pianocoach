"""Pure dashboard statistics: streaks, totals, focus split, daily series.

All functions take plain data and return plain data (no DB), so they're cheap
to unit-test and reuse from both the dashboard router and the coach summary.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta


def compute_streak(practice_dates: list[date], reference_date: date) -> dict:
    """Current + longest run of consecutive days with practice.

    The current streak counts back from `reference_date`; practising "today" or
    "yesterday" keeps it alive (a one-day grace so an unlogged evening doesn't
    feel like failure — this user's weak spot is consistency, be kind).
    """
    days = set(practice_dates)
    if not days:
        return {"current_streak": 0, "longest_streak": 0, "practiced_today": False}

    # Longest streak overall.
    longest = 0
    for d in days:
        if (d - timedelta(days=1)) not in days:  # start of a run
            length = 1
            while (d + timedelta(days=length)) in days:
                length += 1
            longest = max(longest, length)

    # Current streak: walk back from today (allow a 1-day grace).
    start = reference_date if reference_date in days else reference_date - timedelta(days=1)
    current = 0
    cursor = start
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)

    return {
        "current_streak": current,
        "longest_streak": longest,
        "practiced_today": reference_date in days,
    }


def practice_totals(sessions: list, reference_date: date) -> dict:
    """Minutes practised this week (last 7d) and this month (last 30d)."""
    week_cut = reference_date - timedelta(days=7)
    month_cut = reference_date - timedelta(days=30)
    week = sum(s.duration_min for s in sessions if week_cut < s.date <= reference_date)
    month = sum(s.duration_min for s in sessions if month_cut < s.date <= reference_date)
    total = sum(s.duration_min for s in sessions)
    return {
        "week_min": week,
        "month_min": month,
        "total_min": total,
        "week_hours": round(week / 60, 1),
        "month_hours": round(month / 60, 1),
    }


def focus_distribution(sessions: list) -> list[dict]:
    """Minutes per focus area, splitting each session's time across its tags."""
    totals: dict[str, float] = defaultdict(float)
    for s in sessions:
        areas = s.focus_areas or []
        if not areas:
            continue
        share = s.duration_min / len(areas)
        for a in areas:
            totals[a] += share
    return [
        {"focus": k, "minutes": round(v)}
        for k, v in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    ]


def daily_minutes(sessions: list, reference_date: date, days: int = 84) -> list[dict]:
    """Per-day practice minutes over the last `days` (for the constancy graph)."""
    by_day: dict[date, int] = defaultdict(int)
    for s in sessions:
        by_day[s.date] += s.duration_min
    out = []
    for i in range(days - 1, -1, -1):
        d = reference_date - timedelta(days=i)
        out.append({"date": d.isoformat(), "minutes": by_day.get(d, 0)})
    return out
