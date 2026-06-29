import { useEffect, useRef, useState } from "react";
import { Play, Square, Hand } from "lucide-react";
import { PageHeader, Card, SectionTitle, Button } from "../components/ui";

// --- §5.10 Polyrhythm trainer ----------------------------------------------
// Self-contained, no backend. Web Audio API with a lookahead scheduler.
// For an a:b polyrhythm over one cycle of duration T (T = 60 / bpm seconds):
//   - Left hand (a notes) fires at i*T/a, i in [0, a)
//   - Right hand (b notes) fires at j*T/b, j in [0, b)
// They coincide on the downbeat (i = j = 0) -> accent.

type Pattern = { id: string; left: number; right: number; label: string; hint: string };

const PATTERNS: Pattern[] = [
  {
    id: "2:3",
    left: 2,
    right: 3,
    label: "2 contre 3",
    hint: "Compte « pas-en-semble » : le repère mnémotechnique « Not difficult ». Main gauche sur 1 et 3, main droite sur 1, 2, 3.",
  },
  {
    id: "3:4",
    left: 3,
    right: 4,
    label: "3 contre 4",
    hint: "Le 4-contre-3 de la Fantaisie-impromptu. Repère : « Pass the bread and butter » sur 12 doubles-croches. Main gauche tous les 4, main droite tous les 3.",
  },
];

const LOOKAHEAD_MS = 25; // scheduler tick
const SCHEDULE_AHEAD = 0.1; // seconds scheduled in advance

// Pitches: left hand low, right hand high, accent (downbeat) highest+loud.
const FREQ_LEFT = 330; // Mi4 — main gauche
const FREQ_RIGHT = 660; // Mi5 — main droite
const FREQ_ACCENT = 990; // accent du temps fort

export default function Polyrhythm() {
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [bpm, setBpm] = useState(70);
  const [playing, setPlaying] = useState(false);
  // active dot index per hand, -1 = none. Updated by visual rAF synced to audio.
  const [activeLeft, setActiveLeft] = useState(-1);
  const [activeRight, setActiveRight] = useState(-1);

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // mutable refs read inside the scheduler (avoid stale closures)
  const bpmRef = useRef(bpm);
  const patternRef = useRef(pattern);
  const nextCycleStartRef = useRef(0); // absolute ctx time of next cycle's downbeat
  // queue of scheduled hits for the visual indicator: {hand, idx, time}
  const visualQueueRef = useRef<{ hand: "L" | "R"; idx: number; time: number }[]>([]);

  bpmRef.current = bpm;
  patternRef.current = pattern;

  function clickAt(ctx: AudioContext, time: number, freq: number, gainPeak: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainPeak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  function scheduler() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { left: a, right: b } = patternRef.current;
    const T = 60 / bpmRef.current; // one base-pulse cycle in seconds

    while (nextCycleStartRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const start = nextCycleStartRef.current;
      // Left-hand hits
      for (let i = 0; i < a; i++) {
        const t = start + (i * T) / a;
        const accent = i === 0; // downbeat coincides
        clickAt(ctx, t, accent ? FREQ_ACCENT : FREQ_LEFT, accent ? 0.5 : 0.35);
        visualQueueRef.current.push({ hand: "L", idx: i, time: t });
      }
      // Right-hand hits (skip j=0, already played as accent above for the downbeat,
      // but still register the visual so the right dot lights up)
      for (let j = 0; j < b; j++) {
        const t = start + (j * T) / b;
        if (j !== 0) clickAt(ctx, t, FREQ_RIGHT, 0.3);
        visualQueueRef.current.push({ hand: "R", idx: j, time: t });
      }
      nextCycleStartRef.current += T;
    }
  }

  function visualLoop() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const q = visualQueueRef.current;
    // Fire any hits whose time has arrived; keep the most recent per hand.
    let li = -2;
    let ri = -2;
    while (q.length && q[0].time <= now) {
      const hit = q.shift()!;
      if (hit.hand === "L") li = hit.idx;
      else ri = hit.idx;
    }
    if (li !== -2) setActiveLeft(li);
    if (ri !== -2) setActiveRight(ri);
    rafRef.current = requestAnimationFrame(visualLoop);
  }

  async function start() {
    if (playing) return; // guard double-start
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      ctxRef.current = ctx;
    }
    if (ctx.state === "suspended") await ctx.resume();
    visualQueueRef.current = [];
    nextCycleStartRef.current = ctx.currentTime + 0.12; // small priming delay
    setActiveLeft(-1);
    setActiveRight(-1);
    setPlaying(true);
    timerRef.current = window.setInterval(scheduler, LOOKAHEAD_MS);
    scheduler();
    rafRef.current = requestAnimationFrame(visualLoop);
  }

  function stop() {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    visualQueueRef.current = [];
    const ctx = ctxRef.current;
    if (ctx && ctx.state === "running") ctx.suspend();
    setPlaying(false);
    setActiveLeft(-1);
    setActiveRight(-1);
  }

  // Changing pattern or tempo while playing restarts cleanly from the downbeat.
  function selectPattern(p: Pattern) {
    if (p.id === pattern.id) return;
    const wasPlaying = playing;
    if (wasPlaying) stop();
    setPattern(p);
    if (wasPlaying) {
      // restart on next tick once state has propagated to refs
      patternRef.current = p;
      window.setTimeout(() => void start(), 0);
    }
  }

  // Cleanup on unmount: stop oscillators, clear timers, close context.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearInterval(timerRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") void ctx.close();
      ctxRef.current = null;
    };
  }, []);

  const T = 60 / bpm;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Polyrythmie"
        subtitle="Entraîneur 2:3 et 3:4 — métronome visuel et sonore jouant le motif composite des deux mains. Prépare le 4-contre-3 de la Fantaisie-impromptu de Chopin."
        right={
          <Button
            variant={playing ? "ghost" : "primary"}
            onClick={() => (playing ? stop() : void start())}
            className="min-w-32"
          >
            {playing ? (
              <>
                <Square size={16} className="mr-2" /> Arrêter
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" /> Démarrer
              </>
            )}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 space-y-5">
          <SectionTitle title="Réglages" />
          <div>
            <div className="text-sm text-muted mb-2">Motif</div>
            <div className="grid grid-cols-2 gap-2">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPattern(p)}
                  className={
                    "rounded-lg border px-3 py-3 text-center transition-colors " +
                    (p.id === pattern.id
                      ? "border-primary bg-primary-deep/20 text-text"
                      : "border-border bg-surface-2 text-muted hover:text-text")
                  }
                >
                  <div className="text-lg font-bold">{p.id}</div>
                  <div className="text-xs">{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted">Tempo du cycle</span>
              <span className="text-sm font-semibold text-text">{bpm} BPM</span>
            </div>
            <input
              type="range"
              min={40}
              max={160}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <p className="text-xs text-faint mt-2">
              Le BPM règle la pulsation du <em>cycle</em> complet : un cycle dure {T.toFixed(2)} s et
              contient les {pattern.left} frappes de la main gauche et les {pattern.right} de la main
              droite. Commence lentement (≈ 50 BPM), accélère quand le motif est régulier.
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2 space-y-6">
          <SectionTitle
            title={`Motif composite — ${pattern.label}`}
            subtitle="Le point lumineux suit l’audio. Le temps fort (★) marque le repère commun où les deux mains tombent ensemble."
          />

          <HandRow
            label="Main gauche"
            count={pattern.left}
            active={activeLeft}
            color="var(--color-accent)"
            playing={playing}
          />
          <HandRow
            label="Main droite"
            count={pattern.right}
            active={activeRight}
            color="var(--color-primary)"
            playing={playing}
          />

          <CompositeGrid left={pattern.left} right={pattern.right} />
        </Card>
      </div>

      <Card>
        <SectionTitle title="Conseils de travail" />
        <ul className="space-y-2 text-sm text-muted list-disc pl-5">
          <li>{pattern.hint}</li>
          <li>
            Reste <strong className="text-text">détendu·e</strong> : épaules basses, poignets
            souples. Une tension dans l’avant-bras casse l’indépendance des mains.
          </li>
          <li>
            Vocalise d’abord le motif composite à voix haute (frappe les deux mains sur la table),
            sans l’instrument, jusqu’à ce qu’il devienne automatique.
          </li>
          <li>
            Ancre-toi sur le <strong className="text-text">temps fort commun</strong> (★) : c’est le
            seul instant où les deux mains coïncident. Tout le reste s’imbrique entre les deux.
          </li>
          <li>
            Augmente le tempo par paliers de 5 BPM seulement quand le motif est parfaitement régulier
            au tempo courant.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function HandRow({
  label,
  count,
  active,
  color,
  playing,
}: {
  label: string;
  count: number;
  active: number;
  color: string;
  playing: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Hand size={15} style={{ color }} />
        <span className="text-sm font-medium text-text">{label}</span>
        <span className="text-xs text-faint">— {count} frappes / cycle</span>
      </div>
      <div className="flex items-center gap-3">
        {Array.from({ length: count }).map((_, i) => {
          const isActive = playing && active === i;
          const isDownbeat = i === 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="h-9 w-9 rounded-full border-2 transition-all duration-75"
                style={{
                  borderColor: color,
                  backgroundColor: isActive ? color : "transparent",
                  transform: isActive ? "scale(1.18)" : "scale(1)",
                  boxShadow: isActive ? `0 0 14px ${color}` : "none",
                }}
              />
              <span className="text-[11px] text-faint">{isDownbeat ? "★" : i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Composite timeline: positions of every hit on a single normalized cycle [0,1).
function CompositeGrid({ left, right }: { left: number; right: number }) {
  const leftPos = Array.from({ length: left }, (_, i) => i / left);
  const rightPos = Array.from({ length: right }, (_, j) => j / right);
  return (
    <div>
      <div className="text-sm text-muted mb-2">Grille temporelle du cycle</div>
      <div className="relative h-16 rounded-lg bg-surface-2 border border-border">
        {/* downbeat marker */}
        <div className="absolute top-0 bottom-0 left-0 w-px bg-faint/60" />
        {leftPos.map((p, i) => (
          <Marker key={`l${i}`} pos={p} color="var(--color-accent)" top />
        ))}
        {rightPos.map((p, j) => (
          <Marker key={`r${j}`} pos={p} color="var(--color-primary)" />
        ))}
        <span className="absolute left-1.5 top-1 text-[10px] text-faint">★ temps fort</span>
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-accent)" }} /> Main gauche
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-primary)" }} /> Main droite
        </span>
      </div>
    </div>
  );
}

function Marker({ pos, color, top }: { pos: number; color: string; top?: boolean }) {
  return (
    <div
      className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2"
      style={{
        left: `${pos * 100}%`,
        top: top ? "30%" : "60%",
        backgroundColor: color,
        boxShadow: pos === 0 ? `0 0 8px ${color}` : "none",
      }}
    />
  );
}
