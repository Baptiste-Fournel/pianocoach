import { useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AlertTriangle, Film, Trash2, Upload, RefreshCw, Lock } from "lucide-react";
import {
  PageHeader,
  Card,
  SectionTitle,
  Button,
  Badge,
  Stat,
  Empty,
  Spinner,
  Field,
} from "../components/ui";
import { DEMO, api } from "../lib/api";
import { frenchDate, CHART_COLORS } from "../lib/format";
import {
  useSettings,
  usePieces,
  useVideos,
  useVideo,
  useVideoMutations,
} from "../lib/queries";
import type { Piece, Video, VideoFeedback } from "../types";

const STATUS_BADGE: Record<
  Video["analysis_status"],
  { label: string; color: string }
> = {
  pending: { label: "À traiter", color: "var(--color-warn)" },
  analyzing: { label: "Analyse…", color: "var(--color-primary)" },
  done: { label: "Terminé", color: "var(--color-good)" },
  error: { label: "Erreur", color: "var(--color-bad)" },
};

const AXIS = { stroke: "#5b6678", tick: { fill: "#8b97ac", fontSize: 12 } };
const TOOLTIP_STYLE = {
  background: "#1a2234",
  border: "1px solid #283246",
  borderRadius: 8,
  color: "#e8ebf2",
};

function pieceTitle(pieces: Piece[] | undefined, pieceId: number | null): string {
  if (pieceId == null) return "Sans pièce";
  return pieces?.find((p) => p.id === pieceId)?.title ?? "Pièce inconnue";
}

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span className="text-text/90">
        Les retours sont <strong>indicatifs</strong> et générés automatiquement. Ils ne
        remplacent pas l'écoute et les conseils d'un professeur.
      </span>
    </div>
  );
}

function UploadCard({ pieces, ffmpegAvailable }: { pieces: Piece[] | undefined; ffmpegAvailable: boolean }) {
  const { upload } = useVideoMutations();
  const [pieceId, setPieceId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file || DEMO) return;
    upload.mutate(
      {
        file,
        pieceId: pieceId ? Number(pieceId) : undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNotes("");
          setPieceId("");
          setFileName("");
          if (fileRef.current) fileRef.current.value = "";
        },
      }
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Importer une vidéo"
        subtitle="Mesures audio (librosa) à chaque analyse, retour IA selon les réglages."
      />
      {DEMO && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0" />
          <span>
            Démo en lecture seule : l'analyse vidéo nécessite le backend local
            (librosa + Gemini). L'import est désactivé ici.
          </span>
        </div>
      )}
      {!DEMO && !ffmpegAvailable && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>ffmpeg introuvable</strong> — requis pour extraire l'audio. Installe-le puis relance
            l'app : <code className="rounded bg-surface px-1 py-0.5">brew install ffmpeg</code>. (Lancé via
            PianoCoach.app, ffmpeg doit être dans <code className="rounded bg-surface px-1 py-0.5">/opt/homebrew/bin</code>.)
          </span>
        </div>
      )}
      <div className="space-y-4">
        <Field label="Fichier vidéo">
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            disabled={DEMO}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="input file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-text disabled:opacity-50"
          />
        </Field>
        {fileName && <p className="-mt-2 text-xs text-faint">Sélectionné : {fileName}</p>}
        <Field label="Pièce associée (optionnel)">
          <select
            className="input"
            value={pieceId}
            disabled={DEMO}
            onChange={(e) => setPieceId(e.target.value)}
          >
            <option value="">— Aucune —</option>
            {pieces?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.composer ? ` — ${p.composer}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes personnelles (optionnel)">
          <textarea
            className="input min-h-20 resize-y"
            placeholder="Contexte, passage travaillé, ressenti…"
            value={notes}
            disabled={DEMO}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <Button
          onClick={submit}
          disabled={DEMO || upload.isPending || !fileName || !ffmpegAvailable}
        >
          <Upload size={16} />
          {upload.isPending ? "Envoi…" : "Analyser"}
        </Button>
      </div>
    </Card>
  );
}

function MetricCharts({ video }: { video: Video }) {
  const m = video.audio_metrics;
  const tempoData = useMemo(
    () =>
      m
        ? m.tempo.times.map((t, i) => ({ t: Math.round(t), bpm: m.tempo.bpm[i] }))
        : [],
    [m]
  );
  const dynData = useMemo(
    () =>
      m
        ? m.dynamics.times.map((t, i) => ({ t: Math.round(t), rms: m.dynamics.rms[i] }))
        : [],
    [m]
  );
  if (!m) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tempo global" value={`${fmtNum(m.tempo_bpm_global)} BPM`} />
        <Stat
          label="Stabilité tempo"
          value={fmtNum(m.tempo.stability_score, 2)}
          hint="0 → 1, plus haut = plus régulier"
        />
        <Stat
          label="Régularité attaques"
          value={fmtNum(m.onsets.regularity_score, 2)}
          hint={`${m.onsets.onset_count} attaques`}
        />
        <Stat
          label="Plage dynamique"
          value={`${fmtNum(m.dynamics.dynamic_range_db, 1)} dB`}
        />
      </div>

      {tempoData.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted">Tempo au fil du temps (BPM)</h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tempoData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#283246" />
                <XAxis dataKey="t" unit="s" {...AXIS} />
                <YAxis {...AXIS} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [`${fmtNum(Number(v))} BPM`, "Tempo"]}
                  labelFormatter={(l) => `${l} s`}
                />
                <Line
                  type="monotone"
                  dataKey="bpm"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {dynData.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted">Dynamique (RMS) au fil du temps</h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dynData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#283246" />
                <XAxis dataKey="t" unit="s" {...AXIS} />
                <YAxis {...AXIS} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [fmtNum(Number(v), 3), "RMS"]}
                  labelFormatter={(l) => `${l} s`}
                />
                <Line
                  type="monotone"
                  dataKey="rms"
                  stroke={CHART_COLORS[3]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackList({
  title,
  items,
  color,
}: {
  title: string;
  items: string[] | undefined;
  color: string;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold" style={{ color }}>
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-text/90">
            <span style={{ color }}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackText({ title, text }: { title: string; text: string | undefined }) {
  if (!text) return null;
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-text">{title}</h4>
      <p className="text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function AiFeedback({ fb }: { fb: VideoFeedback }) {
  if (fb.error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>Échec du retour IA : {fb.error}</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {fb.overall_summary && (
        <p className="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed text-text">
          {fb.overall_summary}
        </p>
      )}
      <FeedbackList title="Points forts" items={fb.strengths} color="var(--color-good)" />
      <FeedbackList title="À travailler" items={fb.areas_to_work} color="var(--color-warn)" />
      <FeedbackList
        title="Exercices suggérés"
        items={fb.suggested_exercises}
        color="var(--color-accent)"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FeedbackText title="Mains & doigtés" text={fb.hands_and_fingers} />
        <FeedbackText title="Tension / détente" text={fb.tension_vs_release} />
        <FeedbackText title="Posture" text={fb.posture} />
        <FeedbackText title="Tempo & régularité" text={fb.tempo_and_evenness} />
        <FeedbackText title="Sonorité & dynamique" text={fb.tone_and_dynamics} />
      </div>
    </div>
  );
}

function VideoDetail({
  selectedId,
  pieces,
  localOnly,
  geminiConfigured,
  onDeleted,
}: {
  selectedId: number;
  pieces: Piece[] | undefined;
  localOnly: boolean;
  geminiConfigured: boolean;
  onDeleted: () => void;
}) {
  const { reanalyze, update, remove } = useVideoMutations();
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [notesKey, setNotesKey] = useState<number>(-1);

  // Poll while pending/analyzing.
  const polled = useVideo(selectedId, true);
  const stable = useVideo(selectedId, false);
  const video = polled.data ?? stable.data;
  const shouldPoll =
    video?.analysis_status === "pending" || video?.analysis_status === "analyzing";

  if ((polled.isLoading && stable.isLoading) || !video) {
    return (
      <Card>
        <Spinner label="Chargement de la vidéo…" />
      </Card>
    );
  }

  // Seed the notes draft when the selected video changes.
  if (notesKey !== video.id) {
    setNotesKey(video.id);
    setDraftNotes(video.self_notes ?? "");
  }

  const badge = STATUS_BADGE[video.analysis_status];
  const notesDirty = draftNotes !== (video.self_notes ?? "");

  return (
    <Card>
      <SectionTitle
        title={pieceTitle(pieces, video.piece_id)}
        subtitle={frenchDate(video.date)}
        right={<Badge color={badge.color}>{badge.label}</Badge>}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-black">
        <video
          key={video.id}
          controls
          src={api.videoFileUrl(video.id)}
          className="max-h-[420px] w-full bg-black"
        />
      </div>

      <div className="mt-4 space-y-2">
        <Field label="Mes notes">
          <textarea
            className="input min-h-20 resize-y"
            value={draftNotes}
            disabled={DEMO}
            onChange={(e) => setDraftNotes(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            disabled={DEMO || !notesDirty || update.isPending}
            onClick={() =>
              update.mutate({ id: video.id, b: { self_notes: draftNotes } })
            }
          >
            {update.isPending ? "Enregistrement…" : "Enregistrer les notes"}
          </Button>
          <Button
            variant="ghost"
            disabled={DEMO || reanalyze.isPending || shouldPoll}
            onClick={() => reanalyze.mutate(video.id)}
          >
            <RefreshCw size={16} className={reanalyze.isPending ? "animate-spin" : ""} />
            Relancer l'analyse
          </Button>
          <Button
            variant="ghost"
            className="text-bad"
            disabled={DEMO || remove.isPending}
            onClick={() => {
              if (window.confirm("Supprimer définitivement cette vidéo ?")) {
                remove.mutate(video.id, { onSuccess: onDeleted });
              }
            }}
          >
            <Trash2 size={16} />
            Supprimer
          </Button>
        </div>
        {DEMO && (
          <p className="text-xs text-faint">
            Modifications désactivées en démo (lecture seule).
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {shouldPoll && (
          <p className="text-sm text-primary">
            Analyse en cours… cette vue se rafraîchit automatiquement.
          </p>
        )}

        {video.audio_metrics ? (
          <div>
            <h3 className="mb-3 text-base font-semibold text-text">Mesures audio (local)</h3>
            <MetricCharts video={video} />
          </div>
        ) : (
          !shouldPoll && (
            <Empty>Aucune mesure audio disponible pour cette vidéo.</Empty>
          )
        )}

        <div>
          <h3 className="mb-3 text-base font-semibold text-text">Retour IA</h3>
          {localOnly ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <span>
                Mode local activé (confidentialité) : le retour IA est désactivé, seules
                les mesures locales sont calculées. Pour une analyse qualitative, passez
                par le canal MCP / Claude.
              </span>
            </div>
          ) : !geminiConfigured ? (
            <p className="text-sm text-muted">
              Clé Gemini non configurée — ajoutez-la dans les réglages pour activer le
              retour IA.
            </p>
          ) : video.ai_feedback ? (
            <AiFeedback fb={video.ai_feedback} />
          ) : (
            !shouldPoll && <Empty>Aucun retour IA pour cette vidéo.</Empty>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Videos() {
  const settingsQ = useSettings();
  const piecesQ = usePieces();
  const videosQ = useVideos();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const videos = useMemo(
    () =>
      videosQ.data
        ? [...videosQ.data].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        : [],
    [videosQ.data]
  );

  const localOnly = !!settingsQ.data?.video_local_only;
  const geminiConfigured = !!settingsQ.data?.gemini_configured;

  if (videosQ.isLoading || settingsQ.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vidéos" subtitle="Captures de jeu, mesures audio et retours." />
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vidéos"
        subtitle="Filmez votre jeu : mesures audio automatiques et retour qualitatif indicatif."
      />

      <Disclaimer />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1.6fr]">
        <div className="space-y-6">
          <UploadCard pieces={piecesQ.data} ffmpegAvailable={settingsQ.data?.ffmpeg_available !== false} />

          <Card>
            <SectionTitle title="Mes vidéos" subtitle={`${videos.length} enregistrée(s)`} />
            {videos.length === 0 ? (
              <Empty>Aucune vidéo pour le moment. Importez votre premier passage.</Empty>
            ) : (
              <ul className="space-y-2">
                {videos.map((v) => {
                  const badge = STATUS_BADGE[v.analysis_status];
                  const active = v.id === selectedId;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(active ? null : v.id)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary-deep/20"
                            : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        <Film size={18} className="shrink-0 text-faint" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-text">
                            {pieceTitle(piecesQ.data, v.piece_id)}
                          </div>
                          <div className="text-xs text-faint">{frenchDate(v.date)}</div>
                        </div>
                        <Badge color={badge.color}>{badge.label}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div>
          {selectedId == null ? (
            <Card>
              <Empty>Sélectionnez une vidéo pour voir le lecteur et l'analyse.</Empty>
            </Card>
          ) : (
            <VideoDetail
              key={selectedId}
              selectedId={selectedId}
              pieces={piecesQ.data}
              localOnly={localOnly}
              geminiConfigured={geminiConfigured}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
