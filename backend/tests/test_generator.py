from app.services import generator as gen


def _scales():
    return [
        gen.ScaleLike(key="C", type="major", mastered=False, target_bpm=120),
        gen.ScaleLike(key="G", type="major", mastered=False, target_bpm=120),
        gen.ScaleLike(key="D", type="major", mastered=True, target_bpm=120),
    ]


def _pieces():
    return [
        gen.PieceLike(title="Moonlight I", status="in_progress", progress_pct=15),
        gen.PieceLike(title="Fantaisie", status="target", progress_pct=0),
        gen.PieceLike(title="Done piece", status="learned", progress_pct=100),
    ]


def test_minutes_sum_exactly_to_total():
    for total in (45, 60, 90, 91, 137):
        plan = gen.generate_session(total_min=total, weekday=0, scales=_scales(), pieces=_pieces())
        assert plan["total_min"] == total
        assert sum(b["minutes"] for b in plan["blocks"]) == total


def test_deterministic_per_weekday():
    a = gen.generate_session(total_min=90, weekday=2, scales=_scales(), pieces=_pieces())
    b = gen.generate_session(total_min=90, weekday=2, scales=_scales(), pieces=_pieces())
    assert a == b


def test_polyrhythm_alternates_by_weekday_parity():
    even = gen.generate_session(total_min=90, weekday=0, scales=_scales(), pieces=_pieces())
    odd = gen.generate_session(total_min=90, weekday=1, scales=_scales(), pieces=_pieces())
    assert even["polyrhythm"] == "2 contre 3"
    assert odd["polyrhythm"] == "3 contre 4"


def test_scale_of_day_prefers_unmastered():
    # D is mastered; rotation should pick from {C, G}.
    keys = {gen.generate_session(total_min=90, weekday=wd, scales=_scales(), pieces=_pieces())["scale_of_day"]
            for wd in range(7)}
    assert keys <= {"C", "G"}


def test_all_focus_blocks_present_for_reasonable_total():
    plan = gen.generate_session(total_min=120, weekday=3, scales=_scales(), pieces=_pieces())
    focuses = {b["focus"] for b in plan["blocks"]}
    assert focuses == set(gen.DEFAULT_WEIGHTS)
