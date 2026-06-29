import { useEffect, useState } from "react";
import { Check, KeyRound, Lock, ShieldCheck, FolderOpen } from "lucide-react";
import { PageHeader, Card, SectionTitle, Spinner, Empty, Button, Badge, Field, Toggle } from "../components/ui";
import { useSettings, useUpdateSettings } from "../lib/queries";
import { DEMO } from "../lib/api";

export default function Settings() {
  const { data, isLoading, isError } = useSettings();
  const update = useUpdateSettings();

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hydrate editable fields once settings arrive (API key stays write-only / empty).
  useEffect(() => {
    if (data) {
      setModel(data.gemini_model ?? "");
      setLocalOnly(data.video_local_only ?? false);
    }
  }, [data]);

  if (isLoading) return <Spinner label="Chargement des réglages…" />;
  if (isError || !data) return <Empty>Impossible de charger les réglages.</Empty>;

  const dirty =
    apiKey.trim() !== "" ||
    model !== (data.gemini_model ?? "") ||
    localOnly !== (data.video_local_only ?? false);

  async function handleSave() {
    if (DEMO || !data) return;
    const body: { gemini_api_key?: string; gemini_model?: string; video_local_only?: boolean } = {};
    if (apiKey.trim() !== "") body.gemini_api_key = apiKey.trim();
    if (model !== (data.gemini_model ?? "")) body.gemini_model = model.trim();
    if (localOnly !== (data.video_local_only ?? false)) body.video_local_only = localOnly;
    if (Object.keys(body).length === 0) return;
    await update.mutateAsync(body);
    setApiKey("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }

  // Toggle is applied immediately so the privacy choice never gets lost in an unsaved form.
  function handleToggleLocalOnly(v: boolean) {
    setLocalOnly(v);
    if (!DEMO) update.mutate({ video_local_only: v });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réglages"
        subtitle="Configuration de l'IA, confidentialité et stockage local."
      />

      {DEMO && (
        <Card className="border-warn/40 bg-warn/5">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-warn mt-0.5 shrink-0" />
            <div className="text-sm text-muted">
              <span className="text-warn font-medium">Mode démo</span> — aucun serveur n'est connecté.
              Les réglages sont en lecture seule et l'enregistrement est désactivé.
            </div>
          </div>
        </Card>
      )}

      {/* ---- Gemini IA ---- */}
      <Card>
        <SectionTitle
          title="IA Gemini"
          subtitle="Utilisée pour le coach conversationnel et l'analyse vidéo."
          right={
            data.gemini_configured ? (
              <Badge color="var(--color-good)">Clé configurée ✓</Badge>
            ) : (
              <Badge>Aucune clé</Badge>
            )
          }
        />

        <div className="space-y-5">
          <Field label="Clé API Gemini">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-faint shrink-0" />
              <input
                type="password"
                className="input flex-1"
                placeholder={data.gemini_configured ? "•••••••••• (laisser vide pour conserver)" : "Collez votre clé ici"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                disabled={DEMO}
              />
            </div>
            <p className="text-xs text-faint mt-1.5">
              Clé write-only : jamais affichée. Obtenez une clé gratuite sur{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2 hover:text-primary"
              >
                aistudio.google.com/app/apikey
              </a>
              .
            </p>
          </Field>

          <Field label="Modèle Gemini">
            <input
              type="text"
              className="input"
              placeholder="gemini-2.5-flash"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={DEMO}
            />
            <p className="text-xs text-faint mt-1.5">
              Par défaut&nbsp;: <code className="text-muted">gemini-2.5-flash</code>.
            </p>
          </Field>
        </div>
      </Card>

      {/* ---- Confidentialité vidéo ---- */}
      <Card>
        <SectionTitle title="Confidentialité vidéo" subtitle="Contrôlez ce qui est envoyé en ligne." />
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm text-muted max-w-xl">
            <div className="text-text font-medium mb-1">Vidéo 100% locale</div>
            <p>
              Lorsque ce mode est activé, vos vidéos ne sont <span className="text-text">jamais</span> envoyées
              à Gemini : seules les métriques audio locales (librosa) sont calculées sur votre machine.
              Désactivez-le pour bénéficier de l'analyse IA détaillée des vidéos.
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Toggle checked={localOnly} onChange={handleToggleLocalOnly} label="Vidéo 100% locale" />
          </div>
        </div>
      </Card>

      {/* ---- Stockage ---- */}
      <Card>
        <SectionTitle title="Stockage des données" subtitle="Emplacement de vos données sur le disque." />
        <div className="flex items-center gap-3">
          <FolderOpen size={16} className="text-faint shrink-0" />
          <code className="text-sm text-muted break-all bg-surface-2 rounded px-2 py-1.5 flex-1">
            {data.data_dir || "—"}
          </code>
        </div>
      </Card>

      {/* ---- Confidentialité (explainer) ---- */}
      <Card className="border-good/30 bg-good/5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="text-good mt-0.5 shrink-0" />
          <div className="text-sm text-muted space-y-1.5">
            <div className="text-text font-medium">Vos données restent chez vous</div>
            <p>
              Toutes vos données (sessions, morceaux, gammes, vidéos) sont stockées localement et ne quittent
              jamais votre machine.
            </p>
            <p>
              Seuls les appels au <span className="text-text">coach conversationnel</span> et à l'
              <span className="text-text">analyse vidéo par IA</span> sont transmis à Gemini, et uniquement
              lorsqu'une clé API est configurée et que le mode «&nbsp;Vidéo 100% locale&nbsp;» est désactivé.
            </p>
          </div>
        </div>
      </Card>

      {/* ---- Actions ---- */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={DEMO || !dirty || update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-good">
            <Check size={16} /> Réglages enregistrés
          </span>
        )}
        {DEMO && <span className="text-sm text-faint">Désactivé en mode démo</span>}
      </div>
    </div>
  );
}
