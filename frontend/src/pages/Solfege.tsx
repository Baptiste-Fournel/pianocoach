import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Music } from "lucide-react";
import { PageHeader, Card, Button, Badge, Stat } from "../components/ui";
import { Staff } from "../components/Staff";
import { PianoKeyboard } from "../components/PianoKeyboard";
import { useMidiStatus, useMidiStream } from "../lib/useMidi";
import { noteName, pitchClass } from "../lib/midi";
import { DEMO } from "../lib/api";
import {
  type Candidate,
  type Clef,
  type StatMap,
  accuracyPct,
  chooseNext,
  isCorrect,
  notePool,
  statKey,
} from "../lib/solfege";

type ClefMode = "both" | "treble" | "bass";
const MAX_LEVEL = 5;

export default function Solfege() {
  const [clefMode, setClefMode] = useState<ClefMode>("both");
  const [level, setLevel] = useState(1);
  const [target, setTarget] = useState<Candidate | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; played?: number } | null>(null);
  const [session, setSession] = useState({ total: 0, correct: 0, totalMs: 0 });

  const statsRef = useRef<StatMap>({});
  const targetRef = useRef<Candidate | null>(null);
  const lockedRef = useRef(false); // ignore input while showing feedback
  const askedAtRef = useRef(0);
  targetRef.current = target;

  const candidates = useMemo<Candidate[]>(() => {
    const clefs: Clef[] = clefMode === "both" ? ["treble", "bass"] : [clefMode];
    return clefs.flatMap((clef) => notePool(clef, level).map((midi) => ({ midi, clef })));
  }, [clefMode, level]);

  const clickRange = useMemo(() => {
    if (!candidates.length) return { low: 48, high: 72 };
    const midis = candidates.map((c) => c.midi);
    const lo = Math.min(...midis);
    const hi = Math.max(...midis);
    return { low: lo - pitchClass(lo), high: hi + (11 - pitchClass(hi)) };
  }, [candidates]);

  function nextQuestion() {
    lockedRef.current = false;
    setFeedback(null);
    setTarget(chooseNext(candidates, statsRef.current, { bassBias: 1.6 }));
    askedAtRef.current = Date.now();
  }

  // New question whenever the pool changes (clef mode / level).
  useEffect(() => {
    lockedRef.current = false;
    setFeedback(null);
    setTarget(chooseNext(candidates, statsRef.current, { bassBias: 1.6 }));
    askedAtRef.current = Date.now();
  }, [candidates]);

  const handleAnswer = (played: number) => {
    const t = targetRef.current;
    if (!t || lockedRef.current) return;
    lockedRef.current = true;
    const ok = isCorrect(t.midi, played);
    const key = statKey(t.clef, t.midi);
    const s = statsRef.current[key] ?? { seen: 0, wrong: 0 };
    statsRef.current[key] = { seen: s.seen + 1, wrong: s.wrong + (ok ? 0 : 1) };
    const ms = Date.now() - askedAtRef.current;
    setSession((p) => ({
      total: p.total + 1,
      correct: p.correct + (ok ? 1 : 0),
      totalMs: p.totalMs + (ok ? ms : 0),
    }));
    setFeedback({ ok, played });
    window.setTimeout(nextQuestion, ok ? 700 : 1500);
  };
  // Keep the latest handler for the (stable) MIDI subscription.
  const answerRef = useRef(handleAnswer);
  answerRef.current = handleAnswer;

  const status = useMidiStatus();
  const midiAvailable = !!status.data?.available;
  const { connected, active, onNote } = useMidiStream(undefined, midiAvailable && !DEMO);
  useEffect(
    () =>
      onNote((e) => {
        if (e.type === "note_on") answerRef.current(e.note);
      }),
    [onNote]
  );

  const pct = accuracyPct(session.correct, session.total);
  const avgSec = session.correct > 0 ? (session.totalMs / session.correct / 1000).toFixed(1) : "—";
  const canLevelUp = level < MAX_LEVEL && session.total >= 12 && pct >= 90;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trainer de solfège"
        subtitle="La note s'affiche, tu la joues (ou tu la cliques). Validation instantanée, priorité clé de fa, difficulté qui monte."
        right={
          <Badge color={connected ? "var(--color-good)" : "var(--color-faint)"}>
            {connected ? "Piano connecté" : "Clic au clavier"}
          </Badge>
        }
      />

      {/* Controls */}
      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Clé</span>
            {(["both", "bass", "treble"] as ClefMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setClefMode(m)}
                className={
                  "rounded-lg px-3 py-1 text-sm border transition-colors " +
                  (clefMode === m
                    ? "border-primary bg-primary-deep/20 text-text"
                    : "border-border bg-surface-2 text-muted hover:text-text")
                }
              >
                {m === "both" ? "Les deux" : m === "bass" ? "Clé de fa" : "Clé de sol"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Niveau</span>
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={
                  "h-8 w-8 rounded-lg text-sm border transition-colors " +
                  (level === l
                    ? "border-primary bg-primary-deep/20 text-text"
                    : "border-border bg-surface-2 text-muted hover:text-text")
                }
              >
                {l}
              </button>
            ))}
            <span className="text-xs text-faint">tessiture élargie à chaque niveau</span>
          </div>
        </div>
      </Card>

      {/* Question */}
      <Card>
        <div className="flex flex-col items-center gap-4">
          <div className="text-sm text-muted">
            {target?.clef === "bass" ? "Clé de fa" : "Clé de sol"} — quelle note ?
          </div>
          {target && <Staff midi={target.midi} clef={target.clef} state={feedback ? (feedback.ok ? "correct" : "wrong") : "idle"} />}

          <div className="h-8 flex items-center">
            {feedback ? (
              feedback.ok ? (
                <span className="inline-flex items-center gap-2 text-good font-medium">
                  <Check size={18} /> {target && noteName(target.midi)} — bravo !
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-bad font-medium">
                  <X size={18} /> C'était {target && noteName(target.midi)}
                  {feedback.played != null && <span className="text-faint">(tu as joué {noteName(feedback.played)})</span>}
                </span>
              )
            ) : (
              <span className="text-faint text-sm">
                {connected ? "Joue la note sur ton piano…" : "Clique la note sur le clavier ci-dessous"}
              </span>
            )}
          </div>

          <div className="w-full max-w-3xl">
            <PianoKeyboard active={active} low={clickRange.low} high={clickRange.high} onKeyDown={handleAnswer} height={130} />
            <p className="mt-2 text-center text-xs text-faint">
              {connected
                ? "Le piano est prioritaire ; le clavier reste dispo en secours."
                : "Branche ton CN201 (page Piano) pour valider en jouant."}
            </p>
          </div>
        </div>
      </Card>

      {/* Session stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Questions" value={session.total} />
        <Stat label="Précision" value={`${pct} %`} hint={session.total ? `${session.correct}/${session.total}` : "—"} />
        <Stat label="Vitesse moy." value={avgSec === "—" ? "—" : `${avgSec} s`} hint="sur les bonnes réponses" />
        <Stat
          label="Niveau"
          value={level}
          hint={canLevelUp ? "prêt pour le suivant !" : "monte quand tu es à l'aise"}
        />
      </div>

      {canLevelUp && (
        <Card className="border-good/30 bg-good/5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">
              <Music size={15} className="inline mr-1 text-good" />
              {pct}% sur {session.total} questions — prêt·e pour le niveau {level + 1} ?
            </span>
            <Button onClick={() => setLevel((l) => Math.min(MAX_LEVEL, l + 1))}>Niveau {level + 1}</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
