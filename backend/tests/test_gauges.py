from app.services import gauges as g


def _target(track="chopin"):
    return g.PieceLike(title="TARGET", track=track, status="target", progress_pct=0, order_index=10)


def _pieces(track="chopin"):
    return [
        g.PieceLike(title="r1", track=track, status="learned", progress_pct=100, order_index=0),
        g.PieceLike(title="r2", track=track, status="in_progress", progress_pct=40, order_index=1),
        _target(track),
    ]


def test_weights_sum_to_one_per_target():
    for track, w in g.TARGET_PREREQS.items():
        assert abs(sum(w.values()) - 1.0) < 1e-9, track


def test_zero_everything_is_low_readiness():
    t = _target()
    res = g.readiness_for_target(t, [t], [], [], [])
    assert res["readiness_pct"] == 0.0
    assert {c["key"] for c in res["components"]} == set(g.TARGET_PREREQS["chopin"])


def test_mastered_scales_raise_scales_component():
    t = _target("beethoven")
    scales = [g.ScaleLike(key=k, mastered=True, current_bpm=120, target_bpm=120) for k in "CGDAF"]
    res = g.readiness_for_target(t, [t], scales, [], [])
    scales_comp = next(c for c in res["components"] if c["key"] == "scales")
    assert scales_comp["score"] == 100.0


def test_repertoire_component_reflects_rung_progress():
    pieces = _pieces()
    t = pieces[-1]
    res = g.readiness_for_target(t, pieces, [], [], [])
    rep = next(c for c in res["components"] if c["key"] == "repertoire")
    # rungs: learned(100) + in_progress(40) => avg 70
    assert rep["score"] == 70.0


def test_polyrhythm_milestone_counts():
    t = _target("chopin")
    ms = [g.MilestoneLike(label="Polyrythmie 3 contre 4 en chantier", horizon="12m", done=True)]
    res = g.readiness_for_target(t, [t], [], ms, [])
    poly = next(c for c in res["components"] if c["key"] == "polyrhythm")
    assert poly["score"] == 100.0


def test_readiness_never_exceeds_100():
    t = _target("beethoven")
    pieces = [
        g.PieceLike(title="r", track="beethoven", status="learned", progress_pct=100, order_index=0),
        t,
    ]
    scales = [g.ScaleLike(key=k, mastered=True, current_bpm=130, target_bpm=120) for k in "CGDAF"]
    ms = [
        g.MilestoneLike(label="Lecture clé de fa fluide", horizon="3m", done=True),
        g.MilestoneLike(label="Polyrythmie 2 contre 3 maîtrisée", horizon="6m", done=True),
    ]
    reading = [g.ReadingLike(minutes=2000)]
    res = g.readiness_for_target(t, pieces, scales, ms, reading)
    assert 0.0 <= res["readiness_pct"] <= 100.0
