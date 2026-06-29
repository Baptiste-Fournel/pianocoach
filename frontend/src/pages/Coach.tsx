import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Trash2, Sparkles, KeyRound, Info } from "lucide-react";
import { PageHeader, Card, Button, Spinner, Empty } from "../components/ui";
import { DEMO } from "../lib/api";
import { useSettings, useChatMessages, useChatMutations } from "../lib/queries";
import { frenchDate } from "../lib/format";
import type { ChatMessage } from "../types";

const CID = "default";

const SUGGESTIONS = [
  "Comment travailler un passage rapide proprement ?",
  "Quel exercice pour gagner en indépendance des mains ?",
  "Je bloque sur un trait, que faire ?",
  "Comment structurer une séance de 30 minutes ?",
];

export default function Coach() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: messages, isLoading: messagesLoading } = useChatMessages(CID);
  const { send, clear } = useChatMutations(CID);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const configured = !!settings?.gemini_configured;
  const canSend = configured && !send.isPending;

  // Auto-scroll to bottom on new messages or while a reply is pending.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, send.isPending]);

  function submit() {
    const content = draft.trim();
    if (!content || !canSend) return;
    send.mutate(content);
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (settingsLoading || messagesLoading) return <Spinner label="Chargement du coach…" />;

  const list: ChatMessage[] = (messages ?? []).filter((m) => m.role !== "system");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach IA"
        subtitle="Pose tes questions de pratique au piano, obtiens des conseils personnalisés."
        right={
          list.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => clear.mutate()}
              disabled={clear.isPending || DEMO}
            >
              <Trash2 size={16} className="mr-2 inline" />
              Effacer la conversation
            </Button>
          ) : undefined
        }
      />

      {!configured && (
        <Card className="border-warn/40 bg-warn/5">
          <div className="flex items-start gap-3">
            <KeyRound size={20} className="mt-0.5 shrink-0 text-warn" />
            <div className="space-y-2">
              <div className="font-medium text-text">Clé Gemini requise</div>
              <p className="text-sm text-muted">
                Le coach a besoin d'une clé API Gemini pour répondre. Configure-la
                avant de discuter.
              </p>
              <Link to="/reglages" className="btn btn-primary inline-flex w-fit items-center">
                <KeyRound size={16} className="mr-2" />
                Aller aux réglages
              </Link>
            </div>
          </div>
        </Card>
      )}

      <Card className="flex h-[60vh] min-h-[420px] flex-col p-0">
        {/* Message list */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Empty>
                <div className="flex flex-col items-center gap-2">
                  <Sparkles size={28} className="text-primary" />
                  <span>Pose une première question pour démarrer.</span>
                </div>
              </Empty>
              {configured && (
                <div className="flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraft(s)}
                      className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted transition hover:text-text"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            list.map((m) => <Bubble key={m.id} message={m} />)
          )}

          {send.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm text-muted">
                <span className="inline-flex gap-1">
                  <Dot delay="0ms" />
                  <Dot delay="150ms" />
                  <Dot delay="300ms" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!configured}
              rows={2}
              placeholder={
                configured
                  ? "Écris ton message… (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)"
                  : "Configure une clé Gemini pour discuter"
              }
              className="input max-h-40 min-h-[44px] flex-1 resize-y disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              variant="primary"
              onClick={submit}
              disabled={!canSend || draft.trim().length === 0}
              className="h-[44px] shrink-0"
            >
              <Send size={16} className="mr-2 inline" />
              Envoyer
            </Button>
          </div>
        </div>
      </Card>

      <p className="flex items-center justify-center gap-2 text-xs text-faint">
        <Info size={14} />
        Le coach IA ne remplace pas un professeur.
      </p>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-sm bg-primary-deep/20 px-4 py-2.5 text-sm text-text whitespace-pre-wrap"
              : "rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm text-text whitespace-pre-wrap"
          }
        >
          {message.content}
        </div>
        <span className="px-1 text-[11px] text-faint">{frenchDate(message.date)}</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-faint"
      style={{ animationDelay: delay }}
    />
  );
}
