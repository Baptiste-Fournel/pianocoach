import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Trash2, BookOpen, Music } from "lucide-react";
import { PageHeader, Card, SectionTitle, Button, Badge, Stat, Field, Empty, Spinner } from "../components/ui";
import { CLEF_LABELS, formatMinutes, frenchDate, todayISO } from "../lib/format";
import { useReading, useReadingMutations } from "../lib/queries";
import { DEMO } from "../lib/api";
import type { ClefFocus, ReadingLog } from "../types";

const CLEF_ORDER: ClefFocus[] = ["bass", "treble", "both"];
const CLEF_COLORS: Record<ClefFocus, string> = {
  bass: "#6ee7b7",
  treble: "#818cf8",
  both: "#f5b955",
};

function clefColor(c: ClefFocus): string {
  return CLEF_COLORS[c];
}

export default function Reading() {
  const { data, isLoading } = useReading();
  const { create, remove } = useReadingMutations();

  const [date, setDate] = useState(todayISO());
  const [clefFocus, setClefFocus] = useState<ClefFocus>("bass");
  const [material, setMaterial] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [notes, setNotes] = useState("");

  const logs = useMemo(
    () => [...(data ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    [data]
  );

  const stats = useMemo(() => {
    const list = data ?? [];
    const total = list.reduce((s, l) => s + (l.minutes || 0), 0);
    const bass = list.reduce((s, l) => s + (l.clef_focus === "bass" ? l.minutes || 0 : 0), 0);
    const bassPct = total > 0 ? Math.round((bass / total) * 100) : 0;
    return { total, bass, bassPct, count: list.length };
  }, [data]);

  const byClef = useMemo(() => {
    const list = data ?? [];
    return CLEF_ORDER.map((c) => ({
      clef: c,
      label: CLEF_LABELS[c],
      minutes: list.filter((l) => l.clef_focus === c).reduce((s, l) => s + (l.minutes || 0), 0),
    }));
  }, [data]);

  const canSubmit = material.trim().length > 0 && Number(minutes) > 0 && !create.isPending && !DEMO;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        date,
        clef_focus: clefFocus,
        material: material.trim(),
        minutes: Math.round(Number(minutes)),
        notes: notes.trim(),
      } satisfies Partial<ReadingLog>,
      {
        onSuccess: () => {
          setMaterial("");
          setMinutes("15");
          setNotes("");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecture à vue"
        subtitle="Tourner le dos à Synthesia et flowkey : on lit de vraies partitions. Cap sur la clé de fa, ton point faible — c'est là que chaque minute compte le plus."
      />

      {isLoading ? (
        <Spinner label="Chargement du journal de lecture…" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Temps de lecture" value={formatMinutes(stats.total)} hint={`${stats.count} séance${stats.count > 1 ? "s" : ""}`} />
            <Stat label="Dont clé de fa" value={formatMinutes(stats.bass)} hint="La main gauche te dira merci" />
            <Stat
              label="Part clé de fa"
              value={`${stats.bassPct} %`}
              hint={stats.bassPct >= 40 ? "Bel équilibre, continue" : "Vise au moins 40 %"}
            />
            <Stat
              label="Objectif"
              value={stats.bassPct >= 40 ? "Tenu" : "À pousser"}
              hint="Privilégier la clé de fa"
            />
          </div>

          <Card>
            <SectionTitle
              title="Répartition par clé"
              subtitle="Minutes lues sur chaque clé — la clé de fa devrait dominer le graphique."
            />
            {stats.total === 0 ? (
              <Empty>Aucune minute de lecture pour le moment. Ajoute ta première séance ci-dessous.</Empty>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byClef} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid stroke="#283246" vertical={false} />
                    <XAxis dataKey="label" stroke="#5b6678" tick={{ fill: "#8b97ac", fontSize: 12 }} />
                    <YAxis stroke="#5b6678" tick={{ fill: "#8b97ac", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(129,140,248,0.08)" }}
                      formatter={(v) => [formatMinutes(Number(v)), "Lecture"]}
                      contentStyle={{ background: "#1a2234", border: "1px solid #283246", borderRadius: 8, color: "#e8ebf2" }}
                    />
                    <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={90}>
                      {byClef.map((d) => (
                        <Cell key={d.clef} fill={clefColor(d.clef)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-2">
              <SectionTitle title="Ajouter une séance" subtitle="Note ce que tu as déchiffré aujourd'hui." />
              {DEMO && (
                <p className="text-xs text-warn mb-3">Mode démo : l'enregistrement est désactivé (lecture seule).</p>
              )}
              <form onSubmit={submit} className="space-y-4">
                <Field label="Date">
                  <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
                </Field>

                <Field label="Clé travaillée">
                  <div className="flex gap-2">
                    {CLEF_ORDER.map((c) => {
                      const active = clefFocus === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setClefFocus(c)}
                          className="btn flex-1"
                          style={{
                            backgroundColor: active ? "color-mix(in srgb, " + clefColor(c) + " 22%, transparent)" : "var(--color-surface-2)",
                            color: active ? clefColor(c) : "var(--color-muted)",
                            border: active ? `1px solid ${clefColor(c)}` : "1px solid var(--color-border)",
                          }}
                          aria-pressed={active}
                        >
                          {CLEF_LABELS[c]}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Partition / matériel">
                  <input
                    className="input"
                    placeholder="Ex : Bach, Petit Prélude BWV 939"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                  />
                </Field>

                <Field label="Durée (minutes)">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="input"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </Field>

                <Field label="Notes (optionnel)">
                  <textarea
                    className="input min-h-[72px] resize-y"
                    placeholder="Ressenti, passages bloquants, clé de fa hésitante…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>

                <Button type="submit" disabled={!canSubmit}>
                  {create.isPending ? "Enregistrement…" : "Enregistrer la séance"}
                </Button>
              </form>
            </Card>

            <Card className="lg:col-span-3">
              <SectionTitle title="Journal de lecture" subtitle="De la plus récente à la plus ancienne." />
              {logs.length === 0 ? (
                <Empty>Rien d'enregistré. Ouvre une partition et lance-toi — même 10 minutes de clé de fa comptent.</Empty>
              ) : (
                <ul className="space-y-3">
                  {logs.map((l) => (
                    <li key={l.id} className="flex items-start gap-3 rounded-xl bg-surface-2/40 border border-border p-3">
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "color-mix(in srgb, " + clefColor(l.clef_focus) + " 16%, transparent)", color: clefColor(l.clef_focus) }}
                      >
                        {l.clef_focus === "treble" ? <Music size={16} /> : <BookOpen size={16} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-text truncate">{l.material || "Lecture"}</span>
                          <Badge color={clefColor(l.clef_focus)}>{CLEF_LABELS[l.clef_focus]}</Badge>
                          <span className="text-sm text-muted">· {formatMinutes(l.minutes)}</span>
                        </div>
                        <div className="text-xs text-faint mt-0.5">{frenchDate(l.date)}</div>
                        {l.notes && <p className="text-sm text-muted mt-1 whitespace-pre-wrap break-words">{l.notes}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        className="!px-2 shrink-0"
                        aria-label="Supprimer la séance"
                        disabled={DEMO || remove.isPending}
                        onClick={() => {
                          if (DEMO) return;
                          if (confirm("Supprimer cette séance de lecture ?")) remove.mutate(l.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
