import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Music2,
  Music4,
  BookOpen,
  Layers,
  Piano,
  Sparkles,
  Smile,
  Activity,
  ArrowRight,
  Repeat,
  SlidersHorizontal,
  Check,
  RotateCcw,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { PageHeader, Card, SectionTitle, Spinner, Empty, Button } from "../components/ui";
import { useGeneratedSession, useGeneratorConfig, useUpdateGeneratorConfig } from "../lib/queries";
import { FOCUS_LABELS, formatMinutes } from "../lib/format";
import { DEMO } from "../lib/api";
import type { FocusArea, GeneratedSession, GeneratorConfig } from "../types";

const WEIGHT_FOCUSES: FocusArea[] = ["scales", "etudes", "reading", "piece", "polyrhythm", "fun"];
const DEFAULT_WEIGHTS: Record<string, number> = {
  scales: 15,
  etudes: 15,
  reading: 20,
  piece: 30,
  polyrhythm: 10,
  fun: 10,
};

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const DURATION_PRESETS = [45, 90, 120, 240, 480];

// Monday=0 .. Sunday=6
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const FOCUS_ICONS: Record<FocusArea, IconType> = {
  scales: Music2,
  arpeggios: Music4,
  etudes: Activity,
  reading: BookOpen,
  polyrhythm: Layers,
  piece: Piano,
  fun: Smile,
};

const FOCUS_COLORS: Record<FocusArea, string> = {
  scales: "var(--color-primary)",
  arpeggios: "var(--color-accent)",
  etudes: "var(--color-warn)",
  reading: "#7dd3fc",
  polyrhythm: "#c4b5fd",
  piece: "var(--color-good)",
  fun: "#f0a6c8",
};

export default function Generator() {
  const [totalMin, setTotalMin] = useState(90);
  const [weekday, setWeekday] = useState(todayWeekday());

  const { data, isLoading, isError } = useGeneratedSession(totalMin, weekday);

  // Initialise the duration from the saved config (once).
  const { data: config } = useGeneratorConfig();
  const initedRef = useRef(false);
  useEffect(() => {
    if (config && !initedRef.current) {
      initedRef.current = true;
      setTotalMin(config.default_total_min);
    }
  }, [config]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Générateur de séance"
        subtitle="Construis ta séance du jour : ajuste la durée et le jour, le programme s'adapte automatiquement."
      />

      {/* Controls */}
      <Card>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted">Durée totale</span>
              <span className="text-lg font-bold text-text tabular-nums">{formatMinutes(totalMin)}</span>
            </div>
            <input
              type="range"
              min={30}
              max={720}
              step={5}
              value={totalMin}
              onChange={(e) => setTotalMin(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)] cursor-pointer"
              aria-label="Durée totale de la séance"
            />
            <div className="flex justify-between text-xs text-faint mt-1">
              <span>30 min</span>
              <span>12 h</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {DURATION_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant={totalMin === p ? "primary" : "ghost"}
                  onClick={() => setTotalMin(p)}
                  className="text-xs px-2.5 py-1"
                >
                  {formatMinutes(p)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm text-muted mb-2 block">Jour de la semaine</span>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d, i) => {
                const active = weekday === i;
                const isToday = i === todayWeekday();
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWeekday(i)}
                    title={d}
                    className={
                      "rounded-lg py-2 text-xs font-medium transition-colors border " +
                      (active
                        ? "bg-primary-deep/30 border-primary text-text"
                        : "bg-surface-2 border-border text-muted hover:text-text hover:border-primary/40")
                    }
                  >
                    <span className="block">{WEEKDAYS_SHORT[i]}</span>
                    {isToday && <span className="block text-[10px] text-accent mt-0.5">auj.</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <DistributionEditor />

      {isLoading && <Spinner label="Génération de la séance…" />}
      {isError && <Empty>Impossible de générer la séance pour le moment.</Empty>}

      {!isLoading && !isError && data && (
        <SessionView data={data} />
      )}
    </div>
  );
}

function DistributionEditor() {
  const { data: config } = useGeneratorConfig();
  const update = useUpdateGeneratorConfig();
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [defaultMin, setDefaultMin] = useState(90);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    const raw: Record<string, number> = {
      scales: config.w_scales,
      etudes: config.w_etudes,
      reading: config.w_reading,
      piece: config.w_piece,
      polyrhythm: config.w_polyrhythm,
      fun: config.w_fun,
    };
    const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
    setPct(Object.fromEntries(WEIGHT_FOCUSES.map((f) => [f, Math.round((raw[f] / sum) * 100)])));
    setDefaultMin(config.default_total_min);
  }, [config]);

  const total = WEIGHT_FOCUSES.reduce((a, f) => a + (pct[f] ?? 0), 0);

  function save() {
    if (DEMO) return;
    update.mutate(
      {
        w_scales: pct.scales,
        w_etudes: pct.etudes,
        w_reading: pct.reading,
        w_piece: pct.piece,
        w_polyrhythm: pct.polyrhythm,
        w_fun: pct.fun,
        default_total_min: defaultMin,
      } as Partial<GeneratorConfig>,
      { onSuccess: () => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); } }
    );
  }

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between text-left gap-3">
        <SectionTitle
          title="Répartition du temps"
          subtitle="Personnalise le poids de chaque bloc — sauvegardé et réutilisé chaque jour."
        />
        <SlidersHorizontal size={18} className="text-muted shrink-0 mt-1" />
      </button>
      {open && (
        <div className="mt-2 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {WEIGHT_FOCUSES.map((f) => (
              <label key={f} className="flex items-center gap-3">
                <span className="w-28 text-sm text-muted">{FOCUS_LABELS[f]}</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={pct[f] ?? 0}
                  disabled={DEMO}
                  onChange={(e) => setPct((p) => ({ ...p, [f]: Number(e.target.value) }))}
                  className="flex-1 accent-[var(--color-primary)]"
                />
                <span className="w-10 text-right text-sm tabular-nums">{pct[f] ?? 0}%</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={total === 100 ? "text-muted" : "text-warn"}>
              Total : {total}%{total !== 100 && " — normalisé automatiquement"}
            </span>
            <label className="flex items-center gap-2 text-muted">
              Durée par défaut
              <input
                type="number"
                min={10}
                max={1440}
                value={defaultMin}
                disabled={DEMO}
                onChange={(e) => setDefaultMin(Number(e.target.value) || 0)}
                className="input w-24 py-1 px-2"
              />
              min
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={DEMO || update.isPending}>
              {update.isPending ? "Enregistrement…" : "Enregistrer la répartition"}
            </Button>
            <Button variant="ghost" onClick={() => setPct({ ...DEFAULT_WEIGHTS })} disabled={DEMO}>
              <RotateCcw size={14} /> Défauts
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-good">
                <Check size={15} /> Enregistré
              </span>
            )}
            {DEMO && <span className="text-xs text-faint">Lecture seule en démo</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function SessionView({ data }: { data: GeneratedSession }) {
  return (
    <div className="space-y-6">
      {/* Summary header */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Séance du jour</div>
            <h2 className="text-xl font-bold text-text capitalize">{data.weekday_name}</h2>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Total</div>
            <div className="text-2xl font-bold text-primary tabular-nums">{formatMinutes(data.total_min)}</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Highlight icon={Music2} label="Gamme du jour" value={data.scale_of_day} color="var(--color-primary)" />
          <Highlight icon={Piano} label="Pièce du jour" value={data.piece_of_day} color="var(--color-good)" />
          <Highlight icon={Layers} label="Polyrythmie" value={data.polyrhythm} color="#c4b5fd" />
        </div>
      </Card>

      {/* Timeline of blocks */}
      {data.blocks.length === 0 ? (
        <Empty>Aucun bloc dans cette séance.</Empty>
      ) : (
        <div className="space-y-3">
          {data.blocks.map((block, i) => {
            const Icon = FOCUS_ICONS[block.focus] ?? Sparkles;
            const color = FOCUS_COLORS[block.focus] ?? "var(--color-primary)";
            return (
              <Card key={i} className="!p-0 overflow-hidden">
                <div className="flex gap-4 p-4" style={{ borderLeft: `4px solid ${color}` }}>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-text">{block.label}</h3>
                        <span
                          className="text-xs font-medium uppercase tracking-wide"
                          style={{ color }}
                        >
                          {FOCUS_LABELS[block.focus] ?? block.focus}
                        </span>
                      </div>
                      <span className="text-lg font-bold tabular-nums shrink-0" style={{ color }}>
                        {formatMinutes(block.minutes)}
                      </span>
                    </div>
                    {block.detail && (
                      <p className="text-sm text-muted mt-1.5 whitespace-pre-line">{block.detail}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <Card className="bg-surface-2/40">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <Repeat size={16} className="text-faint shrink-0" />
          <span>
            La rotation (gamme, pièce et polyrythmie) change chaque semaine et reste configurable.
          </span>
          <Link
            to="/polyrythmie"
            className="btn btn-ghost text-xs ml-auto inline-flex items-center gap-1.5"
          >
            Entraîneur de polyrythmie
            <ArrowRight size={14} />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Highlight({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: IconType;
  label: string;
  value: string | null;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} className="shrink-0" style={{ color }} />
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      </div>
      <div className="text-sm font-semibold text-text truncate" title={value ?? undefined}>
        {value || "—"}
      </div>
    </div>
  );
}
