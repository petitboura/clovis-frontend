"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Plug, Settings, Briefcase, Share2, Star, Compass, ChevronRight, type LucideIcon } from "lucide-react";
import { NoteAgent } from "@/components/NoteAgent";
import { CommentairesAgent } from "@/components/CommentairesAgent";
import { useOuvrirCatalogue } from "@/lib/contexteCatalogue";

// Créé le 26/08/2026, Bourama : refonte navigation mobile native. Écran
// derrière l'onglet "Plus" de la barre du bas (voir components/mobile/
// BarreOngletsNative.tsx) -- regroupe tout ce qui n'a pas sa place dans
// les 5 onglets principaux, même esprit que la sidebar desktop
// (Personnaliser Clovis / Scolarité déjà groupées là-bas, voir
// AppSidebar.tsx) mais présenté comme une vraie liste de réglages mobile
// (même composants Liste/LigneListe que EspaceParametres.tsx).
//
// Portée de ce chantier (26/08, confirmé par Bourama) : on ne fait que
// ranger l'existant, on ne construit aucun écran qui n'existe pas encore.
// "Admin" n'a été ajouté nulle part ici -- vérifié dans AppSidebar.tsx,
// ce lien n'existe déjà dans AUCUNE navigation actuelle (ni desktop ni
// mobile), donc l'ajouter maintenant serait construire du neuf, pas
// ranger. À trancher avec Bourama avant de l'ajouter.
//
// 28/08/2026, chantier "web mobile façon appli" : cet écran sert
// désormais AUSSI l'onglet "Plus" de BarreOngletsWeb.tsx (nouvelle barre
// du bas web mobile), qui remplace l'ancien tiroir mobile d'AppSidebar.tsx.
// Ce tiroir contenait Partager, Avis sur Clovis et "Pourquoi Clovis ?"
// (dans son dropdown "Plus"), jamais repris ici lors du chantier natif du
// 26/08 -- ajoutés ce jour pour que ces trois actions restent atteignables
// sur mobile (natif ET web), pas seulement sur desktop. "Pourquoi
// Clovis ?" ouvre CatalogueClovis via lib/contexteCatalogue.tsx (créé ce
// jour, même schéma que ContexteChat) plutôt qu'un state local à
// AppShell.tsx comme avant -- c'est ce contexte qui manquait le 28/08
// pour l'ajouter plus tôt.
//
// 30/08/2026, tâche 2 (menu hamburger natif) : la section Personnaliser
// Clovis est désormais séparée (SECTION_PERSONNALISER) plutôt que codée
// en dur dans SECTIONS_BASE -- BlocsMenuPlus (ci-dessous) est le SEUL
// endroit qui construit le rendu réel (icônes, sous-titres, Partager,
// Avis, Pourquoi Clovis), réutilisé à l'identique par EspacePlus (route
// /plus, garde Personnaliser Clovis, inchangé pour le web) ET par
// MenuHamburgerNatif.tsx (nouveau, sans Personnaliser Clovis puisque
// c'est déjà un onglet de la barre du bas native, voir tâche 1). Objectif
// : un seul endroit qui définit ce que fait chaque lien, jamais deux
// copies qui pourraient diverger.
const SECTION_PERSONNALISER: { icone: LucideIcon; titre: string; sousTitre?: string; href: string } = {
  icone: Wand2,
  titre: "Personnaliser Clovis",
  sousTitre: "Mes skills, ma mémoire",
  href: "/personnaliser",
};

// Exporté (pas seulement local) : MenuHamburgerNatif.tsx (30/08/2026)
// réutilise ce même tableau tel quel, pour ne jamais avoir une deuxième
// liste de "Connecter Claude / Bureau / Paramètres" qui pourrait diverger
// de celle-ci au fil du temps.
export const SECTIONS_BASE: { icone: LucideIcon; titre: string; sousTitre?: string; href: string }[] = [
  { icone: Plug, titre: "Connecter Claude", sousTitre: "Utiliser Clovis dans Claude", href: "/connecter-claude" },
  { icone: Briefcase, titre: "Bureau", href: "/bureau" },
  { icone: Settings, titre: "Paramètres", sousTitre: "Profil, confidentialité, capacités du téléphone...", href: "/parametres" },
];

function LigneSection({ icone: Icone, titre, sousTitre, onClick }: { icone: LucideIcon; titre: string; sousTitre?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
    >
      <Icone size={18} className="flex-shrink-0 text-dj-texte-muet" />
      <div className="flex-1 overflow-hidden">
        <div className="truncate text-sm text-dj-texte">{titre}</div>
        {sousTitre && <div className="truncate text-xs text-dj-texte-muet">{sousTitre}</div>}
      </div>
      <ChevronRight size={16} className="flex-shrink-0 text-dj-texte-muet" />
    </button>
  );
}

const AGENT_ID = "clovis";

// Rendu réel des deux blocs (navigation + actions), partagé entre
// EspacePlus (page /plus) et MenuHamburgerNatif (30/08/2026). Le seul
// paramètre est la liste des sections du bloc 1 : EspacePlus lui passe
// Personnaliser Clovis + le reste, le menu hamburger natif lui passe le
// reste seul.
export function BlocsMenuPlus({ sectionsNavigation }: { sectionsNavigation: typeof SECTIONS_BASE }) {
  const router = useRouter();
  const [copie, setCopie] = useState(false);
  const [avisDeplie, setAvisDeplie] = useState(false);
  const ouvrirCatalogue = useOuvrirCatalogue();

  // Repris à l'identique de la fonction `partager` d'AppSidebar.tsx.
  async function partager() {
    const url = window.location.origin;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Clovis", url });
      } catch {
        // Annulé par la personne.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papier indisponible, tant pis.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
        <div className="divide-y divide-dj-bordure">
          {sectionsNavigation.map((s) => (
            <LigneSection key={s.href} icone={s.icone} titre={s.titre} sousTitre={s.sousTitre} onClick={() => router.push(s.href)} />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
        <div className="divide-y divide-dj-bordure">
          <button
            onClick={partager}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
          >
            <Share2 size={18} className="flex-shrink-0 text-dj-texte-muet" />
            <span className="flex-1 text-sm text-dj-texte">{copie ? "Copié !" : "Partager"}</span>
          </button>
          <button
            onClick={() => setAvisDeplie((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
          >
            <Star size={18} className="flex-shrink-0 text-dj-texte-muet" />
            <span className="flex-1 text-sm text-dj-texte">Avis sur Clovis</span>
          </button>
          {avisDeplie && (
            <div className="flex flex-col gap-4 p-4">
              <NoteAgent agentId={AGENT_ID} />
              <CommentairesAgent agentId={AGENT_ID} />
            </div>
          )}
          <button
            onClick={ouvrirCatalogue}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
          >
            <Compass size={18} className="flex-shrink-0 text-dj-texte-muet" />
            <span className="flex-1 text-sm text-dj-texte">Pourquoi Clovis ?</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function EspacePlus() {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <BlocsMenuPlus sectionsNavigation={[SECTION_PERSONNALISER, ...SECTIONS_BASE]} />
    </div>
  );
}
