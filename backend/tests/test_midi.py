"""MIDI service tests. The round-trip uses a VIRTUAL port (no hardware needed);
it skips cleanly where rtmidi/virtual ports are unavailable (e.g. CI Linux)."""

import time

import pytest
from app.services import midi


def test_available_and_list_never_crash():
    assert isinstance(midi.available(), bool)
    assert isinstance(midi.list_input_ports(), list)


def test_resolve_port_prefers_requested_else_first():
    ports = midi.list_input_ports()
    if not ports:
        assert midi.resolve_port(None) is None
        assert midi.resolve_port("whatever") is None
    else:
        assert midi.resolve_port(ports[0]) == ports[0]
        assert midi.resolve_port("nonexistent-port") == ports[0]


def test_virtual_port_note_roundtrip():
    if not midi.available():
        pytest.skip("MIDI backend (rtmidi) unavailable")
    import mido

    mido.set_backend("mido.backends.rtmidi")
    name = "PianoCoach Virtual Test"
    try:
        outport = mido.open_output(name, virtual=True)
    except Exception as e:  # noqa: BLE001 - virtual ports unsupported on some hosts
        pytest.skip(f"virtual MIDI ports unsupported here: {e}")

    received = []
    try:
        match = [n for n in mido.get_input_names() if name in n]
        if not match:
            pytest.skip("virtual output did not surface as an input port")
        inport = midi.open_input(match[0], received.append)
        try:
            outport.send(mido.Message("note_on", note=60, velocity=100))
            outport.send(mido.Message("note_off", note=60, velocity=0))
            deadline = time.time() + 2.0
            while time.time() < deadline and len(received) < 2:
                time.sleep(0.02)
        finally:
            inport.close()
    finally:
        outport.close()

    note_ons = [m for m in received if m.type == "note_on" and m.velocity > 0]
    assert any(m.note == 60 for m in note_ons), f"no note_on(60) received: {received}"
