import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DEMO } from "./api";

export interface MidiStatus {
  available: boolean;
  ports: string[];
}

export interface MidiNoteEvent {
  type: "note_on" | "note_off";
  note: number;
  velocity: number;
}

/** Poll the backend for MIDI availability + connected input ports. */
export function useMidiStatus() {
  return useQuery<MidiStatus>({
    queryKey: ["midi-status"],
    queryFn: async () => {
      if (DEMO) return { available: false, ports: [] };
      const r = await fetch("/api/midi/status");
      return r.json();
    },
    refetchInterval: 5000,
  });
}

type NoteHandler = (e: MidiNoteEvent) => void;

/**
 * Open a WebSocket to the backend MIDI stream and track currently-held notes.
 * `onNote` lets a consumer (e.g. the solfège trainer) subscribe to raw events.
 */
export function useMidiStream(port: string | undefined, enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<number>>(new Set());
  const handlersRef = useRef<NoteHandler[]>([]);

  const onNote = useCallback((h: NoteHandler) => {
    handlersRef.current.push(h);
    return () => {
      handlersRef.current = handlersRef.current.filter((x) => x !== h);
    };
  }, []);

  useEffect(() => {
    if (!enabled || DEMO) {
      setConnected(false);
      return;
    }
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const q = port ? `?port=${encodeURIComponent(port)}` : "";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/midi/stream${q}`);
    setError(null);

    ws.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.error) {
        setError(d.error);
        return;
      }
      if (d.connected) {
        setConnected(true);
        return;
      }
      if (d.type === "note_on") {
        setActive((s) => new Set(s).add(d.note));
      } else if (d.type === "note_off") {
        setActive((s) => {
          const n = new Set(s);
          n.delete(d.note);
          return n;
        });
      }
      if (d.type) handlersRef.current.forEach((h) => h(d as MidiNoteEvent));
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("Connexion au flux MIDI impossible.");

    return () => {
      ws.close();
      setConnected(false);
      setActive(new Set());
    };
  }, [port, enabled]);

  return { connected, error, active, onNote };
}
