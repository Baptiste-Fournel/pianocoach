import { Link } from "react-router-dom";
import {
  ExternalLink,
  Music,
  BookOpen,
  Timer,
  FileText,
  GraduationCap,
  Bot,
} from "lucide-react";
import { PageHeader, Card, SectionTitle, Badge } from "../components/ui";

type LinkItem = {
  title: string;
  description: string;
  url: string;
  badge?: string;
};

type LinkGroup = {
  title: string;
  subtitle: string;
  icon: typeof Music;
  items: LinkItem[];
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const GROUPS: LinkGroup[] = [
  {
    title: "Partitions (IMSLP)",
    subtitle: "Téléchargement libre des partitions du répertoire",
    icon: Music,
    items: [
      {
        title: "Fantaisie-impromptu, op. 66",
        description: "Chopin — édition du domaine public sur IMSLP.",
        url: "https://imslp.org/wiki/Fantaisie-impromptu,_Op.66_(Chopin,_Frédéric)",
      },
      {
        title: "Sonate op. 27 no. 2 « Clair de lune »",
        description: "Beethoven — Sonate pour piano no. 14.",
        url: "https://imslp.org/wiki/Piano_Sonata_No.14,_Op.27_No.2_(Beethoven,_Ludwig_van)",
      },
      {
        title: "Préludes, op. 28",
        description: "Chopin — recueil complet des 24 préludes.",
        url: "https://imslp.org/wiki/Preludes,_Op.28_(Chopin,_Frédéric)",
      },
      {
        title: "Nocturnes, op. 9",
        description: "Chopin — les trois nocturnes de l'opus 9.",
        url: "https://imslp.org/wiki/Nocturnes,_Op.9_(Chopin,_Frédéric)",
      },
    ],
  },
  {
    title: "Théorie & lecture",
    subtitle: "Réviser les bases et entraîner la lecture de notes",
    icon: BookOpen,
    items: [
      {
        title: "musictheory.net",
        description: "Leçons et exercices interactifs de théorie musicale.",
        url: "https://www.musictheory.net/",
      },
      {
        title: "teoria",
        description: "Exercices d'oreille et de lecture.",
        url: "https://www.teoria.com/",
        badge: "Travailler la clé de fa",
      },
    ],
  },
];

function LinkCard({ item }: { item: LinkItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card group flex flex-col gap-2 transition-colors hover:border-primary/60 focus:outline-none focus-visible:border-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-text group-hover:text-primary">{item.title}</h3>
        <ExternalLink
          size={16}
          className="mt-0.5 shrink-0 text-faint transition-colors group-hover:text-primary"
        />
      </div>
      <p className="text-sm text-muted">{item.description}</p>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <span className="text-xs text-faint">{domainOf(item.url)}</span>
        {item.badge && <Badge color="warn">{item.badge}</Badge>}
      </div>
    </a>
  );
}

export default function Resources() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Ressources"
        subtitle="Partitions, théorie et outils utiles pour la pratique"
      />

      {GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.title} className="space-y-4">
            <SectionTitle
              title={group.title}
              subtitle={group.subtitle}
              right={<Icon size={18} className="text-faint" />}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <LinkCard key={item.url} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-4">
        <SectionTitle
          title="Métronome / polyrythmie"
          subtitle="S'entraîner au tempo et superposer les rythmes"
          right={<Timer size={18} className="text-faint" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/polyrythmie"
            className="card group flex flex-col gap-2 transition-colors hover:border-primary/60 focus:outline-none focus-visible:border-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-text group-hover:text-primary">
                Entraîneur de polyrythmie
              </h3>
              <Timer
                size={16}
                className="mt-0.5 shrink-0 text-faint transition-colors group-hover:text-primary"
              />
            </div>
            <p className="text-sm text-muted">
              Outil intégré pour travailler le métronome et les polyrythmies (2:3, 3:4…).
            </p>
            <div className="mt-auto flex items-center gap-2 pt-1">
              <Badge color="primary">Dans l'app</Badge>
            </div>
          </Link>

          <Card className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-text">Applis métronome</h3>
              <Timer size={16} className="mt-0.5 shrink-0 text-faint" />
            </div>
            <p className="text-sm text-muted">
              En complément, des applications mobiles dédiées comme Soundbrenner ou Pro
              Metronome offrent un métronome précis et tactile.
            </p>
            <div className="mt-auto pt-1">
              <span className="text-xs text-faint">Suggestion hors ligne</span>
            </div>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle
          title="Mes documents de plan"
          subtitle="Le plan de travail et le coach restent locaux"
          right={<FileText size={18} className="text-faint" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-text">Plan & profil</h3>
              <GraduationCap size={16} className="mt-0.5 shrink-0 text-faint" />
            </div>
            <p className="text-sm text-muted">
              Le plan de progression et le profil de pratique sont stockés localement sur
              ton appareil — aucun lien externe nécessaire.
            </p>
            <div className="mt-auto pt-1">
              <Badge color="good">Local</Badge>
            </div>
          </Card>

          <Link
            to="/coach"
            className="card group flex flex-col gap-2 transition-colors hover:border-primary/60 focus:outline-none focus-visible:border-primary"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-text group-hover:text-primary">
                Coach intégré
              </h3>
              <Bot
                size={16}
                className="mt-0.5 shrink-0 text-faint transition-colors group-hover:text-primary"
              />
            </div>
            <p className="text-sm text-muted">
              Pose tes questions et obtiens des conseils personnalisés directement dans
              l'application.
            </p>
            <div className="mt-auto pt-1">
              <Badge color="primary">Dans l'app</Badge>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
