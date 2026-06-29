import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  PageHeader,
  Card,
  SectionTitle,
  Spinner,
  Empty,
  Button,
  Badge,
  Field,
} from "../components/ui";
import { DEMO } from "../lib/api";
import { usePieces, useTempoProgression, useTempoMutations } from "../lib/queries";
import { CHART_COLORS, shortDate, frenchDate, todayISO } from "../lib/format";
import type { TempoProgression } from "../types";

const AXIS_STROKE = "#5b6678";
const TICK = { fill: "#8b97ac", fontSize: 12 };
const TOOLTIP_STYLE = {
  background: "#1a2234",
  border: "1px solid #283246",
  borderRadius: 8,
  color: "#e8ebf2",
};

export default function Tempo() {
  const { data: pieces, isLoading: piecesLoading } = usePieces();
  const { data: progressions, isLoading: progLoading } = useTempoProgression();
  const { log } = useTempoMutations();

  const [pieceId, setPieceId] = useState<string>("");
  const [passage, setPassage] = useState("");
  const [bpm, setBpm] = useState("");
  const [date, setDate] = useState(todayISO());

  const canSubmit =
    !DEMO &&
    pieceId !== "" &&
    passage.trim() !== "" &&
    bpm.trim() !== "" &&
    Number(bpm) > 0 &&
    date !== "" &&
    !log.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    log.mutate(
      {
        piece_id: Number(pieceId),
        passage_label: passage.trim(),
        bpm_clean: Number(bpm),
        date,
      },
      {
        onSuccess: () => {
          setPassage("");
          setBpm("");
          setDate(todayISO());
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tempo propre"
        subtitle="Journalisez le tempo « propre » par passage et suivez la progression."
        right={
          DEMO ? (
            <Badge color="var(--color-warn)">Démo — lecture seule</Badge>
          ) : undefined
        }
      />

      <Card>
        <SectionTitle
          title="Ajouter un relevé"
          subtitle="Tempo joué proprement (sans faute) sur un passage donné."
        />
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Pièce">
            <select
              className="input"
              value={pieceId}
              onChange={(e) => setPieceId(e.target.value)}
              disabled={DEMO}
            >
              <option value="">Choisir une pièce…</option>
              {(pieces ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.composer ? ` — ${p.composer}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Passage">
            <input
              className="input"
              type="text"
              placeholder="ex. mesures 1-16"
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              disabled={DEMO}
            />
          </Field>

          <Field label="Tempo propre (BPM)">
            <input
              className="input"
              type="number"
              min={1}
              step={1}
              placeholder="ex. 92"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              disabled={DEMO}
            />
          </Field>

          <Field label="Date">
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={DEMO}
            />
          </Field>

          <div className="md:col-span-2 lg:col-span-4 flex items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {log.isPending ? "Enregistrement…" : "Enregistrer le relevé"}
            </Button>
            {DEMO && (
              <span className="text-faint text-sm">
                Les modifications sont désactivées dans la démo.
              </span>
            )}
          </div>
        </form>
      </Card>

      {piecesLoading || progLoading ? (
        <Spinner label="Chargement des progressions…" />
      ) : !progressions || progressions.length === 0 ? (
        <Empty>
          Aucune progression de tempo pour l'instant. Enregistrez un premier relevé
          ci-dessus pour voir apparaître un graphique.
        </Empty>
      ) : (
        <div className="space-y-6">
          {progressions.map((prog) => (
            <ProgressionCard key={prog.piece_id} prog={prog} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressionCard({ prog }: { prog: TempoProgression }) {
  const color = CHART_COLORS[prog.piece_id % CHART_COLORS.length];

  // Plot all points chronologically as a single line by date.
  const chartData = useMemo(
    () =>
      [...prog.points]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((pt) => ({
          ...pt,
          x: shortDate(pt.date),
        })),
    [prog.points]
  );

  const bpmValues = chartData.map((d) => d.bpm_clean);
  const maxLogged = bpmValues.length ? Math.max(...bpmValues) : 0;
  const latest = bpmValues.length ? bpmValues[bpmValues.length - 1] : null;

  const yMax = Math.ceil(
    Math.max(maxLogged, prog.target_tempo ?? 0) * 1.08 + 4
  );

  return (
    <Card>
      <SectionTitle
        title={prog.piece_title}
        subtitle={
          latest != null
            ? `Dernier tempo propre : ${latest} BPM`
            : undefined
        }
        right={
          prog.target_tempo != null ? (
            <Badge color="var(--color-accent)">Cible {prog.target_tempo} BPM</Badge>
          ) : (
            <Badge color="var(--color-faint)">Pas de cible</Badge>
          )
        }
      />

      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="#283246" strokeDasharray="3 3" />
            <XAxis dataKey="x" stroke={AXIS_STROKE} tick={TICK} />
            <YAxis
              stroke={AXIS_STROKE}
              tick={TICK}
              domain={[0, yMax]}
              allowDecimals={false}
              width={44}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "#8b97ac" }}
              formatter={(value, _name, item) => [
                `${value} BPM`,
                (item?.payload?.passage_label as string) ?? "Tempo propre",
              ]}
            />
            {prog.target_tempo != null && (
              <ReferenceLine
                y={prog.target_tempo}
                stroke="var(--color-accent)"
                strokeDasharray="6 4"
                label={{ value: "Cible", position: "right", fill: "#8b97ac", fontSize: 12 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="bpm_clean"
              name="Tempo propre"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <div className="text-faint text-xs uppercase tracking-wide mb-2">
          Relevés ({chartData.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-faint text-left">
                <th className="font-medium py-1 pr-4">Date</th>
                <th className="font-medium py-1 pr-4">Passage</th>
                <th className="font-medium py-1 text-right">Tempo propre</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((pt, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-1.5 pr-4 text-muted">{frenchDate(pt.date)}</td>
                  <td className="py-1.5 pr-4 text-text">{pt.passage_label}</td>
                  <td className="py-1.5 text-right text-text tabular-nums">
                    {pt.bpm_clean} BPM
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
