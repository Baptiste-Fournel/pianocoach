import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Trash2, Plus, Music2, Piano } from "lucide-react";
import {
  PageHeader,
  Card,
  SectionTitle,
  Spinner,
  Empty,
  Button,
  Badge,
  ProgressBar,
  Toggle,
  Modal,
  Field,
} from "../components/ui";
import { useScales, useScaleBpmHistory, useScaleMutations } from "../lib/queries";
import { CHART_COLORS, frenchDate, noteFr, noteToCanonical, shortDate } from "../lib/format";
import { DEMO } from "../lib/api";
import { ScaleVerify } from "../components/ScaleVerify";
import type { Scale, ScaleType, Hands } from "../types";

const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  major: "Majeure",
  minor_harmonic: "Mineure harmonique",
  minor_melodic: "Mineure mélodique",
};

const HANDS_LABELS: Record<Hands, string> = {
  separate: "Séparées",
  together: "Ensemble",
};

const SCALE_TYPE_ORDER: ScaleType[] = ["major", "minor_harmonic", "minor_melodic"];
const HANDS_ORDER: Hands[] = ["separate", "together"];

const KEY_SUGGESTIONS = [
  "Do",
  "Sol",
  "Ré",
  "La",
  "Mi",
  "Si",
  "Fa#",
  "Do#",
  "Fa",
  "Sib",
  "Mib",
  "Lab",
  "Réb",
  "Solb",
  "Dob",
];

export default function Scales() {
  const { data: scales, isLoading } = useScales();
  const { data: history, isLoading: historyLoading } = useScaleBpmHistory();
  const { create, update, remove } = useScaleMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [verifyScale, setVerifyScale] = useState<Scale | null>(null);
  const [form, setForm] = useState<{ key: string; type: ScaleType; hands: Hands; target_bpm: number }>({
    key: "Do",
    type: "major",
    hands: "separate",
    target_bpm: 120,
  });

  // Local draft of the inline-editable current_bpm values, keyed by scale id,
  // so the input stays responsive before we commit on blur / Enter.
  const [bpmDraft, setBpmDraft] = useState<Record<number, string>>({});

  const sortedScales = useMemo(() => {
    if (!scales) return [];
    return [...scales].sort((a, b) => {
      if (a.mastered !== b.mastered) return a.mastered ? 1 : -1;
      if (a.key !== b.key) return a.key.localeCompare(b.key, "fr");
      return SCALE_TYPE_ORDER.indexOf(a.type) - SCALE_TYPE_ORDER.indexOf(b.type);
    });
  }, [scales]);

  // Build the merged multi-line dataset: one row per date, one column per scale.
  const { chartData, chartSeries } = useMemo(() => {
    const groups = (history ?? []).filter((g) => g.points.length > 0);
    const series = groups.map((g, i) => {
      const typeShort =
        g.type === "major" ? "M" : g.type === "minor_harmonic" ? "m harm." : g.type === "minor_melodic" ? "m mél." : g.type;
      return {
        id: g.scale_id,
        dataKey: `s${g.scale_id}`,
        name: `${noteFr(g.key)} ${typeShort}`,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    const byDate = new Map<string, Record<string, number | string>>();
    for (const g of groups) {
      for (const p of g.points) {
        let row = byDate.get(p.date);
        if (!row) {
          row = { date: p.date };
          byDate.set(p.date, row);
        }
        row[`s${g.scale_id}`] = p.bpm;
      }
    }
    const rows = [...byDate.values()].sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    );
    return { chartData: rows, chartSeries: series };
  }, [history]);

  function commitBpm(scale: Scale) {
    const draft = bpmDraft[scale.id];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    setBpmDraft((d) => {
      const copy = { ...d };
      delete copy[scale.id];
      return copy;
    });
    if (next !== null && (Number.isNaN(next) || next < 0)) return;
    if (next === scale.current_bpm) return;
    update.mutate({ id: scale.id, b: { current_bpm: next } });
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!form.key.trim()) return;
    create.mutate({
      key: noteToCanonical(form.key),
      type: form.type,
      hands: form.hands,
      target_bpm: form.target_bpm,
      current_bpm: null,
      mastered: false,
    });
    setModalOpen(false);
    setForm({ key: "Do", type: "major", hands: "separate", target_bpm: 120 });
  }

  if (isLoading) return <Spinner label="Chargement des gammes…" />;

  const masteredCount = sortedScales.filter((s) => s.mastered).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gammes & arpèges"
        subtitle="Suivi du tempo propre par gamme et courbe d'évolution du BPM."
        right={
          <Button onClick={() => setModalOpen(true)} disabled={DEMO}>
            <Plus size={16} /> Ajouter une gamme
          </Button>
        }
      />

      {DEMO && (
        <div className="text-xs text-faint rounded-lg border border-border bg-surface-2 px-3 py-2">
          Mode démo : les modifications ne sont pas enregistrées.
        </div>
      )}

      <Card>
        <SectionTitle
          title="Mes gammes"
          subtitle={
            sortedScales.length
              ? `${sortedScales.length} gamme${sortedScales.length > 1 ? "s" : ""} · ${masteredCount} maîtrisée${
                  masteredCount > 1 ? "s" : ""
                }`
              : undefined
          }
        />

        {sortedScales.length === 0 ? (
          <Empty>
            Aucune gamme pour le moment. Ajoutez-en une pour suivre votre tempo propre et sa progression.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">Tonalité</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Mains</th>
                  <th className="py-2 pr-3 font-medium w-28">BPM actuel</th>
                  <th className="py-2 pr-3 font-medium">Cible</th>
                  <th className="py-2 pr-3 font-medium w-40">Progression</th>
                  <th className="py-2 pr-3 font-medium">Maîtrisée</th>
                  <th className="py-2 pr-3 font-medium">Travaillée le</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sortedScales.map((s) => {
                  const draft = bpmDraft[s.id];
                  const current = draft !== undefined ? Number(draft) || 0 : s.current_bpm ?? 0;
                  const pct = s.target_bpm > 0 ? (current / s.target_bpm) * 100 : 0;
                  const reached = pct >= 100;
                  return (
                    <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                      <td className="py-2.5 pr-3 font-semibold text-text">{noteFr(s.key)}</td>
                      <td className="py-2.5 pr-3 text-muted">{SCALE_TYPE_LABELS[s.type]}</td>
                      <td className="py-2.5 pr-3">
                        <Badge color={s.hands === "together" ? "var(--color-accent)" : "var(--color-faint)"}>
                          {HANDS_LABELS[s.hands]}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          min={0}
                          className="input w-20 py-1 px-2 text-sm"
                          value={draft !== undefined ? draft : s.current_bpm ?? ""}
                          placeholder="—"
                          disabled={DEMO}
                          onChange={(e) => setBpmDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                          onBlur={() => commitBpm(s)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-muted">{s.target_bpm}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ProgressBar
                              value={pct}
                              color={reached ? "var(--color-good)" : "var(--color-primary)"}
                            />
                          </div>
                          <span className={`text-xs tabular-nums ${reached ? "text-good" : "text-faint"}`}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Toggle
                          checked={s.mastered}
                          onChange={(v) => !DEMO && update.mutate({ id: s.id, b: { mastered: v } })}
                          label={`Marquer ${noteFr(s.key)} ${SCALE_TYPE_LABELS[s.type]} comme maîtrisée`}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-faint whitespace-nowrap">{frenchDate(s.last_practiced)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1"
                            disabled={DEMO}
                            aria-label={`Vérifier la gamme ${noteFr(s.key)} au piano`}
                            title="Vérifier au piano (MIDI)"
                            onClick={() => setVerifyScale(s)}
                          >
                            <Piano size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-bad"
                            disabled={DEMO}
                            aria-label={`Supprimer la gamme ${noteFr(s.key)}`}
                            onClick={() => {
                              if (window.confirm(`Supprimer la gamme ${noteFr(s.key)} ${SCALE_TYPE_LABELS[s.type]} ?`)) {
                                remove.mutate(s.id);
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Évolution du BPM"
          subtitle="Une courbe par gamme, basée sur le tempo propre enregistré au fil du temps."
        />
        {historyLoading ? (
          <Spinner label="Chargement de la courbe…" />
        ) : chartSeries.length === 0 ? (
          <Empty>
            <div className="flex flex-col items-center gap-1">
              <Music2 size={24} className="text-faint" />
              <span>
                Aucune progression enregistrée pour l'instant. Mettez à jour le BPM actuel de vos gammes : chaque
                relevé construit la courbe d'évolution.
              </span>
            </div>
          </Empty>
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#283246" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => shortDate(d as string)}
                  stroke="#5b6678"
                  tick={{ fill: "#8b97ac", fontSize: 12 }}
                />
                <YAxis
                  stroke="#5b6678"
                  tick={{ fill: "#8b97ac", fontSize: 12 }}
                  width={42}
                  label={{ value: "BPM", angle: -90, position: "insideLeft", fill: "#8b97ac", fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(d) => frenchDate(d as string)}
                  contentStyle={{
                    background: "#1a2234",
                    border: "1px solid #283246",
                    borderRadius: 8,
                    color: "#e8ebf2",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8b97ac" }} />
                {chartSeries.map((s) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter une gamme">
        <form onSubmit={submitNew} className="space-y-4">
          <Field label="Tonalité">
            <input
              className="input w-full"
              list="scale-key-suggestions"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="ex. Do, Sol, Fa#…"
              autoFocus
            />
            <datalist id="scale-key-suggestions">
              {KEY_SUGGESTIONS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>

          <Field label="Type">
            <select
              className="input w-full"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ScaleType }))}
            >
              {SCALE_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SCALE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mains">
            <select
              className="input w-full"
              value={form.hands}
              onChange={(e) => setForm((f) => ({ ...f, hands: e.target.value as Hands }))}
            >
              {HANDS_ORDER.map((h) => (
                <option key={h} value={h}>
                  {HANDS_LABELS[h]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="BPM cible">
            <input
              type="number"
              min={1}
              className="input w-full"
              value={form.target_bpm}
              onChange={(e) => setForm((f) => ({ ...f, target_bpm: Number(e.target.value) || 0 }))}
            />
          </Field>

          {DEMO && (
            <p className="text-xs text-faint">Mode démo : la gamme ne sera pas réellement enregistrée.</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={DEMO || create.isPending || !form.key.trim()}>
              {create.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </Modal>

      {verifyScale && <ScaleVerify scale={verifyScale} onClose={() => setVerifyScale(null)} />}
    </div>
  );
}
