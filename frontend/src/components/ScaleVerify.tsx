import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Square } from "lucide-react";
import { Modal, Button, Badge, Field } from "./ui";
import { PianoKeyboard } from "./PianoKeyboard";
import { useMidiStatus, useMidiStream } from "../lib/useMidi";
import { keyToPitchClass, noteName } from "../lib/midi";
import {
  DEFAULT_EVENNESS_THRESHOLD,
  type ScaleCheck,
  type ScaleKind,
  checkScale,
  expectedScale,
  suggestedBpm,
} from "../lib/scaleCheck";
import { useScaleMutations } from "../lib/queries";
import type { Scale } from "../types";

const THRESHOLD_PCT = Math.round(DEFAULT_EVENNESS_THRESHOLD * 100);

// Verify a scale by playing it on the MIDI keyboard. "Propre" = exact notes +
// even rhythm (CV ≤ threshold). Only then do we OFFER a BPM to log — you confirm
// or edit it; nothing is written silently.
export function ScaleVerify({ scale, onClose }: { scale: Scale; onClose: () => void }) {
  const status = useMidiStatus();
  const midiAvailable = !!status.data?.available;
  const { connected, active, onNote } = useMidiStream(undefined, midiAvailable);
  const { update } = useScaleMutations();

  const [octaves, setOctaves] = useState(1);
  const [notesPerBeat, setNotesPerBeat] = useState(4);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState<ScaleCheck | null>(null);
  const [captured, setCaptured] = useState<number[]>([]); // played notes (for display)
  const [bpm, setBpm] = useState<number>(scale.current_bpm ?? scale.target_bpm);
  const [saved, setSaved] = useState(false);

  const rootPc = keyToPitchClass(scale.key) ?? 0;
  const expected = useMemo(
    () => expectedScale(48 + rootPc, scale.type as ScaleKind, octaves), // octave-independent match
    [rootPc, scale.type, octaves]
  );

  const bufferRef = useRef<{ note: number; t: number }[]>([]);
  const capturingRef = useRef(false);
  const expectedRef = useRef(expected);
  expectedRef.current = expected;

  function finalize() {
    capturingRef.current = false;
    setCapturing(false);
    const buf = bufferRef.current;
    const r = checkScale(
      buf.map((b) => b.note),
      buf.map((b) => b.t),
      expectedRef.current
    );
    setCaptured(buf.map((b) => b.note));
    setResult(r);
    if (r.clean && r.attackRatePerMin) setBpm(suggestedBpm(r.attackRatePerMin, notesPerBeat));
  }
  const finalizeRef = useRef(finalize);
  finalizeRef.current = finalize;

  useEffect(
    () =>
      onNote((e) => {
        if (!capturingRef.current || e.type !== "note_on") return;
        bufferRef.current.push({ note: e.note, t: performance.now() });
        if (bufferRef.current.length >= expectedRef.current.length) finalizeRef.current();
      }),
    [onNote]
  );

  function start() {
    bufferRef.current = [];
    setCaptured([]);
    setResult(null);
    setSaved(false);
    capturingRef.current = true;
    setCapturing(true);
  }

  // Recompute the suggested BPM if notes-per-beat changes after a clean run.
  useEffect(() => {
    if (result?.clean && result.attackRatePerMin) setBpm(suggestedBpm(result.attackRatePerMin, notesPerBeat));
  }, [notesPerBeat, result]);

  function saveBpm() {
    update.mutate(
      { id: scale.id, b: { current_bpm: bpm } },
      { onSuccess: () => { setSaved(true); window.setTimeout(onClose, 900); } }
    );
  }

  const lo = Math.min(...expected) - 2;
  const hi = Math.max(...expected) + 2;

  return (
    <Modal open onClose={onClose} title={`Vérifier au piano — ${noteName(48 + rootPc).replace(/\d+$/, "")} ${scale.type === "major" ? "majeur" : "mineur"}`}>
      <div className="space-y-4">
        {!midiAvailable || !connected ? (
          <p className="text-sm text-warn">
            Aucun piano connecté. Va sur la page <strong>Piano (MIDI)</strong>, branche ton CN201, puis reviens —
            la vérification de gamme se fait en jouant.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                Octaves
                <select className="input w-auto py-1" value={octaves} onChange={(e) => setOctaves(Number(e.target.value))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                Notes / temps
                <select className="input w-auto py-1" value={notesPerBeat} onChange={(e) => setNotesPerBeat(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-faint">Seuil de régularité : CV ≤ {THRESHOLD_PCT}%</span>
            </div>

            <div className="text-xs text-muted">
              À jouer (ascendant) : {expected.map((n) => noteName(n)).join(" · ")}
            </div>

            <PianoKeyboard active={active} low={lo} high={hi} height={110} />

            <div className="flex items-center gap-2">
              {!capturing ? (
                <Button onClick={start}>
                  <Circle size={14} /> {result ? "Recommencer" : "Démarrer"}
                </Button>
              ) : (
                <Button variant="ghost" onClick={finalize}>
                  <Square size={14} /> Terminer ({bufferRef.current.length}/{expected.length})
                </Button>
              )}
              {capturing && <span className="text-sm text-faint">Joue la gamme, régulièrement…</span>}
            </div>

            {result && (
              <div className="rounded-lg border border-border bg-surface-2/50 p-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge color={result.notesCorrect ? "var(--color-good)" : "var(--color-bad)"}>
                    Notes {result.notesCorrect ? "exactes" : "fautées"}
                  </Badge>
                  <Badge color={result.even ? "var(--color-good)" : "var(--color-warn)"}>
                    Régularité CV {result.cvPct}%
                  </Badge>
                  {result.attackRatePerMin && (
                    <Badge color="var(--color-primary)">
                      ≈ {Math.round(result.attackRatePerMin)} attaques/min
                    </Badge>
                  )}
                </div>
                <p className={result.clean ? "text-good" : "text-muted"}>{result.reason}</p>
                {!result.notesCorrect && result.wrongAt != null && captured[result.wrongAt] != null && (
                  <p className="text-xs text-faint">
                    1ʳᵉ erreur : attendu {noteName(expected[result.wrongAt])}, joué {noteName(captured[result.wrongAt])}.
                  </p>
                )}

                {result.clean ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Field label={`BPM propre suggéré (${notesPerBeat} notes/temps)`}>
                      <input
                        type="number"
                        min={1}
                        className="input w-28"
                        value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value) || 0)}
                      />
                    </Field>
                    <Button onClick={saveBpm} disabled={update.isPending || bpm <= 0}>
                      {update.isPending ? "Enregistrement…" : "Enregistrer ce BPM"}
                    </Button>
                    {saved && (
                      <span className="inline-flex items-center gap-1 text-good text-sm">
                        <Check size={15} /> Enregistré
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-faint">
                    Aucun BPM enregistré : la gamme doit être exacte <em>et</em> régulière (CV ≤ {THRESHOLD_PCT}%).
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
