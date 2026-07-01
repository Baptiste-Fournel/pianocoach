"""Integration tests for the API routers (Phase 2: CRUD, cascade, validation)."""


def _new_piece(client, **over):
    body = {"title": "T", "composer": "C", "track": "common"}
    body.update(over)
    r = client.post("/api/pieces", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_seed_present(client):
    pieces = client.get("/api/pieces").json()
    assert len(pieces) >= 14
    assert any(p["status"] == "target" for p in pieces)


def test_delete_piece_cascades_tempo_and_unlinks_video(client):
    from app.db import session_scope
    from app.models import Video

    p = _new_piece(client, title="CascadeTest")
    pid = p["id"]
    client.post("/api/tempo", json={"piece_id": pid, "bpm_clean": 72, "passage_label": "m1"})
    with session_scope() as s:
        v = Video(piece_id=pid, file_path="/tmp/none.mp4")
        s.add(v)
        s.commit()
        s.refresh(v)
        vid = v.id

    assert client.delete(f"/api/pieces/{pid}").status_code == 204
    assert client.get(f"/api/pieces/{pid}").status_code == 404
    assert client.get(f"/api/tempo?piece_id={pid}").json() == []  # B5: no FK error, logs gone
    with session_scope() as s:
        assert s.get(Video, vid).piece_id is None  # video kept, unlinked


def test_delete_scale_removes_bpm_history(client):
    from app.db import session_scope
    from app.models import ScaleBpmLog
    from sqlmodel import select

    sc = client.post("/api/scales", json={"key": "C", "type": "major", "target_bpm": 120}).json()
    sid = sc["id"]
    client.patch(f"/api/scales/{sid}", json={"current_bpm": 80})  # creates a history point
    assert client.delete(f"/api/scales/{sid}").status_code == 204
    with session_scope() as s:
        remaining = s.exec(select(ScaleBpmLog).where(ScaleBpmLog.scale_id == sid)).all()
        assert remaining == []


def test_input_validation(client):
    assert client.post("/api/pieces", json={"title": "B", "composer": "C", "progress_pct": 150}).status_code == 422
    assert client.post("/api/pieces", json={"title": "B", "composer": "C", "difficulty": 99}).status_code == 422
    assert client.post("/api/tempo", json={"piece_id": 1, "bpm_clean": 0}).status_code == 422
    assert client.post("/api/sessions", json={"duration_min": -5}).status_code == 422
    assert client.post("/api/sessions", json={"tension_level": 9}).status_code == 422


def test_tempo_patch_and_clean_tempo_resync(client):
    p = _new_piece(client, title="TempoResync")
    pid = p["id"]
    log = client.post("/api/tempo", json={"piece_id": pid, "bpm_clean": 50}).json()
    assert client.get(f"/api/pieces/{pid}").json()["current_clean_tempo"] == 50
    client.patch(f"/api/tempo/{log['id']}", json={"bpm_clean": 80})
    assert client.get(f"/api/pieces/{pid}").json()["current_clean_tempo"] == 80
    client.delete(f"/api/tempo/{log['id']}")
    assert client.get(f"/api/pieces/{pid}").json()["current_clean_tempo"] is None


def test_tempo_progression_points_have_ids(client):
    p = _new_piece(client, title="ProgIds", target_tempo=100)
    client.post("/api/tempo", json={"piece_id": p["id"], "bpm_clean": 60})
    prog = client.get("/api/tempo/progression").json()
    grp = next(g for g in prog if g["piece_id"] == p["id"])
    assert all("id" in pt for pt in grp["points"])


def test_loved_preference(client):
    p = _new_piece(client, title="Loved", loved=True)
    assert p["loved"] is True
    updated = client.patch(f"/api/pieces/{p['id']}", json={"loved": False}).json()
    assert updated["loved"] is False


def test_generator_no_4h_cap(client):
    # 600 min (10 h) must be accepted (no artificial 480/240 cap).
    r = client.get("/api/generator/session?total_min=600&weekday=0")
    assert r.status_code == 200
    assert r.json()["total_min"] == 600
