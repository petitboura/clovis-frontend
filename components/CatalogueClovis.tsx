"use client";

import {
  X,
  Compass,
  Brain,
  Library,
  Calculator,
  Smartphone,
  Upload,
  Download,
  Share2,
  Plug,
  Bot,
} from "lucide-react";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Catalogue "Ce qui différencie Clovis" (14/08, demande Bourama : "un
// catalogue qui explique les choses différentes des autres IA quand on
// arrive dans le chat"). Contenu audité directement sur le code réel des
// deux dépôts (clovis-backend + classgpt-frontend), pas un texte marketing
// générique -- voir la conversation d'origine pour le détail par fichier.
//
// Deux points d'entrée (demande explicite) : un teaser sur l'écran
// d'accueil du chat (ChatIA.tsx, tant qu'aucun message n'a été envoyé) et
// un bouton dédié réouvrable à tout moment (SidebarChatLite.tsx). Les deux
// pointent vers ce même composant, état géré par le parent (app/page.tsx),
// même pattern que CompteRequisModal.

type Fonctionnalite = {
  Icone: typeof Brain;
  titre: string;
  description: string;
};

const FONCTIONNALITES: Fonctionnalite[] = [
  {
    Icone: Library,
    titre: "Bibliothèque personnelle",
    description:
      "Les documents que tu envoies restent exploitables dans toutes tes conversations, pas seulement celle où tu les as postés.",
  },
  {
    Icone: Calculator,
    titre: "De vrais outils de maths",
    description:
      "Calcul symbolique, éditeur de formules et de réactions chimiques, dessin de géométrie, pas juste du texte qui décrit une réponse.",
  },
  {
    Icone: Smartphone,
    titre: "Une vraie application",
    description: "S'installe sur téléphone ou ordinateur, avec notifications, pas juste un site ouvert dans un onglet.",
  },
  {
    Icone: Bot,
    titre: "Une IA qui agit, pas juste qui répond",
    description:
      "Clovis peut naviguer dans l'appli comme toi, ajouter des documents dans ta bibliothèque, et mettre à jour sa mémoire de toi sans que tu aies à tout faire à la main.",
  },
  {
    Icone: Share2,
    titre: "Partage en un code",
    description:
      "Partage ta bibliothèque ou tes skills via un simple code ; tout se propage automatiquement chez celui qui le reçoit.",
  },
  {
    Icone: Plug,
    titre: "Connectable à Claude",
    description:
      "Une fois connecté, Claude peut naviguer dans Clovis exactement comme toi, dans la bibliothèque et la mémoire, pas juste lire des données en vrac.",
  },
];

const ENTREES = [
  "Images (JPEG, PNG, WebP)",
  "Documents (PDF, Word, Excel)",
  "Vidéo (jusqu'à 2 min)",
  "Audio (dictée vocale)",
  "Position géographique",
  "Photo d'une formule",
];

const SORTIES = [
  "Documents Word, Excel, PowerPoint, LaTeX",
  "Code et sites web déployables",
  "Images et voix de synthèse",
  "Modèles 3D et vidéos",
  "Documents à signer électroniquement",
  "Rappels programmés",
];

export function CatalogueClovis({ onFerme }: { onFerme: () => void }) {
  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : ce panneau animait son ouverture (animate-cgpt-entree-modal)
  // mais le parent (AppShell.tsx) le démonte via `{catalogueOuvert && ...}`,
  // donc la fermeture retirait le composant du DOM sans jamais jouer
  // d'animation de sortie. Même mécanisme que lib/useFermetureAnimee.ts
  // (déjà utilisé par PanneauFlottant et les 8 popups qui passent par
  // lui) : ce composant reste monté ~180ms de plus le temps que
  // cgpt-sortie-modal joue, puis appelle le onFerme réel du parent.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(onFerme);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 sm:items-center ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={fermer}
    >
      <div
        className={`flex max-h-[85vh] w-full max-w-2xl flex-col rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_2px_24px_rgba(0,0,0,0.35)] ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-dj-bordure px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dj-accent-1/10 text-dj-accent-1-texte">
              <Compass size={18} />
            </span>
            <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-dj-texte">Ce qui différencie Clovis</h2>
          </div>
          <button
            onClick={fermer}
            aria-label="Fermer"
            className="flex-shrink-0 text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {FONCTIONNALITES.map(({ Icone, titre, description }) => (
              <div key={titre} className="flex flex-col gap-1.5 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface-haute p-3.5">
                <div className="flex items-center gap-2">
                  <Icone size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <span className="text-sm font-semibold text-dj-texte">{titre}</span>
                </div>
                <p className="text-xs leading-relaxed text-dj-texte-muet">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 border-t border-dj-bordure pt-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dj-texte-muet">
                <Upload size={13} />
                Ce que tu peux lui envoyer
              </div>
              <ul className="space-y-1">
                {ENTREES.map((item) => (
                  <li key={item} className="text-sm text-dj-texte">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dj-texte-muet">
                <Download size={13} />
                Ce qu'il peut créer pour toi
              </div>
              <ul className="space-y-1">
                {SORTIES.map((item) => (
                  <li key={item} className="text-sm text-dj-texte">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
