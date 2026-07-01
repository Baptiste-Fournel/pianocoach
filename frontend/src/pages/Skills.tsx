import { useState } from "react";
import { PageHeader, Card, Spinner, ProgressBar, Button } from "../components/ui";
import { usePieces, useSessions, useBackfillSkills } from "../lib/queries";
import { skillActivityMinutes, skillProgress } from "../lib/skills";
import { formatMinutes } from "../lib/format";
import { DEMO } from "../lib/api";

export default function Skills() {
  const { data: pieces, isLoading } = usePieces();
  const { data: sessions } = useSessions();
  const backfill = useBackfillSkills();
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  if (isLoading || !pieces) return <Spinner label="Chargement des compétences…" />;

  const progress = skillProgress(pieces);
  const activity = skillActivityMinutes(sessions ?? [], pieces, 30);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compétences"
        subtitle="Chaque pièce développe des compétences ; ta progression s'agrège ici et monte à mesure que tes pièces avancent."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {progress.map((sk) => {
          const priority = sk.id === "reading_bass";
          return (
            <Card key={sk.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">
                  {sk.label}
                  {priority && <span className="ml-2 text-xs text-accent">priorité</span>}
                </h3>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: sk.progress >= 100 ? "var(--color-good)" : "var(--color-primary)" }}
                >
                  {sk.progress}%
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5 mb-2">{sk.hint}</p>
              <ProgressBar value={sk.progress} color={priority ? "var(--color-accent)" : undefined} />
              <div className="mt-3 flex items-center justify-between text-xs text-faint">
                <span>{sk.pieces.length} pièce(s)</span>
                <span>{formatMinutes(activity[sk.id] || 0)} travaillées (30 j)</span>
              </div>
              {sk.pieces.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sk.pieces.map((p) => (
                    <span
                      key={p.title}
                      className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs"
                      title={`${p.progress}%`}
                    >
                      {p.title} · {p.progress}%
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="text-sm text-muted">
          <span className="text-text font-medium">Comment c'est calculé : </span>
          la progression d'une compétence = moyenne de l'avancement des pièces qui la développent (pièce
          apprise = 100 %). Les minutes (30 j) proviennent de tes séances (zones travaillées + pièces jouées).
          Tag tes pièces depuis le <span className="text-text">Répertoire</span>. La capture de pièce, à venir,
          enrichira ce suivi.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            disabled={DEMO || backfill.isPending}
            onClick={() =>
              backfill.mutate(undefined, {
                onSuccess: (r) =>
                  setBackfillMsg(
                    r.updated > 0
                      ? `${r.updated} pièce(s) du seed taguée(s).`
                      : "Aucune pièce du seed à taguer — tout est déjà à jour."
                  ),
              })
            }
          >
            {backfill.isPending ? "…" : "Appliquer les tags par défaut (pièces du seed)"}
          </Button>
          {backfillMsg && <span className="text-sm text-good">{backfillMsg}</span>}
          <span className="text-xs text-faint">
            N'affecte que les pièces du seed non taguées — jamais tes ajouts ni tes tags existants.
          </span>
        </div>
      </Card>
    </div>
  );
}
