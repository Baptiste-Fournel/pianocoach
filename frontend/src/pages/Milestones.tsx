import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  PageHeader,
  Card,
  SectionTitle,
  Button,
  Badge,
  ProgressBar,
  Empty,
  Spinner,
  Field,
} from "../components/ui";
import { TRACKS, HORIZONS, HORIZON_LABELS, frenchDate } from "../lib/format";
import { DEMO } from "../lib/api";
import { useDashboard, useMilestones, useMilestoneMutations } from "../lib/queries";
import type { Horizon, Milestone, Readiness } from "../types";

function readinessTone(pct: number): string {
  if (pct >= 80) return "var(--color-good)";
  if (pct >= 50) return "var(--color-primary)";
  if (pct >= 30) return "var(--color-warn)";
  return "var(--color-faint)";
}

function RadialGauge({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const size = 120;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (clamped / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {Math.round(clamped)}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-faint">prêt</span>
      </div>
    </div>
  );
}

function ReadinessCard({ r }: { r: Readiness }) {
  const track = TRACKS[r.track];
  const tone = readinessTone(r.readiness_pct);
  const totalWeight = r.components.reduce((s, c) => s + (c.weight || 0), 0) || 1;
  return (
    <Card>
      <div className="flex items-start gap-4">
        <RadialGauge pct={r.readiness_pct} color={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-text truncate">{r.target_title}</h3>
            <Badge color={track.color}>{track.short}</Badge>
          </div>
          <div className="mt-3 space-y-2.5">
            {r.components.length === 0 && (
              <p className="text-sm text-muted">Aucun critère évalué pour le moment.</p>
            )}
            {r.components.map((c) => {
              const weightPct = Math.round((c.weight / totalWeight) * 100);
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted truncate">{c.label}</span>
                    <span className="text-faint tabular-nums ml-2 shrink-0">
                      {Math.round(c.score)}% · pèse {weightPct}%
                    </span>
                  </div>
                  <ProgressBar value={c.score} color={track.color} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MilestoneRow({
  m,
  onToggle,
  onDelete,
  busy,
}: {
  m: Milestone;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy || DEMO}
        aria-pressed={m.done}
        aria-label={m.done ? "Marquer non fait" : "Marquer comme fait"}
        className="shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors disabled:opacity-50"
        style={{
          backgroundColor: m.done ? "var(--color-good)" : "transparent",
          borderColor: m.done ? "var(--color-good)" : "var(--color-border)",
        }}
      >
        {m.done && <Check size={14} className="text-bg" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <span
          className={
            m.done
              ? "text-sm text-faint line-through decoration-good/60"
              : "text-sm text-text"
          }
        >
          {m.label}
        </span>
        {m.done && (
          <span className="ml-2 text-xs text-faint">· atteint le {frenchDate(m.date_done)}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={DEMO}
        aria-label="Supprimer le jalon"
        className="shrink-0 text-faint hover:text-bad opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-0"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function Milestones() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: milestones, isLoading: msLoading } = useMilestones();
  const { create, update, remove } = useMilestoneMutations();

  const [newLabel, setNewLabel] = useState("");
  const [newHorizon, setNewHorizon] = useState<Horizon>("3m");

  const grouped = useMemo(() => {
    const map: Record<Horizon, Milestone[]> = { "3m": [], "6m": [], "12m": [], "24m": [] };
    for (const m of milestones ?? []) map[m.horizon]?.push(m);
    for (const h of HORIZONS) map[h].sort((a, b) => a.order_index - b.order_index);
    return map;
  }, [milestones]);

  function handleAdd() {
    const label = newLabel.trim();
    if (!label || DEMO) return;
    create.mutate({ label, horizon: newHorizon });
    setNewLabel("");
  }

  if (dashLoading || msLoading) return <Spinner label="Chargement des objectifs…" />;

  const readiness = dash?.readiness ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jalons & objectifs"
        subtitle="Une feuille de route bienveillante. Avance à ton rythme — chaque case cochée est une vraie victoire."
        right={
          DEMO ? (
            <span className="text-xs text-faint">Mode démo · lecture seule</span>
          ) : undefined
        }
      />

      {/* Readiness gauges */}
      <section>
        <SectionTitle
          title="Prêt pour…"
          subtitle="Estimation de ta progression vers chaque pièce cible. Indicatif, jamais un jugement."
        />
        {readiness.length === 0 ? (
          <Card>
            <Empty>
              Aucune pièce cible pour l’instant. Définis une cible dans ton répertoire pour suivre ta
              préparation ici.
            </Empty>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {readiness.map((r) => (
              <ReadinessCard key={r.target_title} r={r} />
            ))}
          </div>
        )}
      </section>

      {/* Checklist */}
      <section className="space-y-5">
        <SectionTitle
          title="Feuille de route"
          subtitle="Des repères à 3, 6, 12 et 24 mois. Rien d’obligatoire — juste des intentions."
        />

        {/* Add form */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Field label="Nouveau jalon">
                <input
                  className="input w-full"
                  placeholder="Ex. Jouer la première page sans accroc"
                  value={newLabel}
                  disabled={DEMO}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />
              </Field>
            </div>
            <div className="w-32">
              <Field label="Horizon">
                <select
                  className="input w-full"
                  value={newHorizon}
                  disabled={DEMO}
                  onChange={(e) => setNewHorizon(e.target.value as Horizon)}
                >
                  {HORIZONS.map((h) => (
                    <option key={h} value={h}>
                      {HORIZON_LABELS[h]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button
              onClick={handleAdd}
              disabled={DEMO || !newLabel.trim() || create.isPending}
            >
              <Plus size={16} className="mr-1.5 -ml-0.5" />
              Ajouter un jalon
            </Button>
          </div>
          {DEMO && (
            <p className="text-xs text-faint mt-3">
              En mode démo, l’ajout et les modifications sont désactivés.
            </p>
          )}
        </Card>

        {(milestones?.length ?? 0) === 0 ? (
          <Card>
            <Empty>
              Pas encore de jalon. Ajoute une petite intention ci-dessus pour commencer — un pas à la
              fois.
            </Empty>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {HORIZONS.map((h) => {
              const items = grouped[h];
              const done = items.filter((m) => m.done).length;
              return (
                <Card key={h}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-text">{HORIZON_LABELS[h]}</h3>
                    <Badge color={done === items.length && items.length > 0 ? "var(--color-good)" : "var(--color-muted)"}>
                      {done}/{items.length}
                    </Badge>
                  </div>
                  {items.length > 0 && (
                    <div className="mb-2">
                      <ProgressBar
                        value={items.length ? (done / items.length) * 100 : 0}
                        color="var(--color-good)"
                      />
                    </div>
                  )}
                  {items.length === 0 ? (
                    <p className="text-sm text-faint py-2">Aucun jalon ici pour l’instant.</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {items.map((m) => (
                        <MilestoneRow
                          key={m.id}
                          m={m}
                          busy={update.isPending}
                          onToggle={() => update.mutate({ id: m.id, b: { done: !m.done } })}
                          onDelete={() => remove.mutate(m.id)}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
