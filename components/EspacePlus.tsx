"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Plug, Settings, Bell, Share2, Star, Compass, ChevronRight, type LucideIcon } from "lucide-react";
import { NoteAgent } from "@/components/NoteAgent";
import { CommentairesAgent } from "@/components/CommentairesAgent";
import { useOuvrirCatalogue } from "@/lib/contexteCatalogue";

// Créé le 26/08/2026, Bourama : refonte navigation mobile native. Contenu
// du menu "Plus", partagé entre l'appli native et le web mobile.
//
// 30/08/2026, audit navigation web mobile vs natif, étape 1 : web mobile
// et natif ont désormais exactement les mêmes 5 onglets directs
// (Bibliothèque, Concentration, Chat, Bureau, Personnaliser Clovis, voir
// BarreOngletsNative.tsx et BarreOngletsWeb.tsx), donc Personnaliser
// Clovis n'a plus besoin d'une place à part ici (SECTION_PERSONNALISER
// supprimée, elle vivait dans ce fichier depuis la tâche du même jour sur
// le menu hamburger natif). Accueil, qui n'avait de son côté aucun accès
// dans l'appli native (orphelin, signalé par Bourama), rejoint
// SECTIONS_BASE : le menu Plus est maintenant strictement identique des
// deux côtés, un seul et même contenu défini ici (BlocsMenuPlus), utilisé
// par MenuHamburgerNatif.tsx (natif) et MenuHamburgerWeb.tsx (web mobile,
// nouveau, remplace l'ancienne page /plus, désormais une simple
// redirection, voir app/(app)/plus/page.tsx).
//
// "Admin" n'a été ajouté nulle part ici, vérifié dans AppSidebar.tsx,
// ce lien n'existe déjà dans AUCUNE navigation actuelle (ni desktop ni
// mobile), donc l'ajouter maintenant serait construire du neuf, pas
// ranger. À trancher avec Bourama avant de l'ajouter.
//
// Partager, Avis sur Clovis et "Pourquoi Clovis ?" restent dans le bloc
// d'actions ci-dessous (ajoutés le 28/08/2026 pour rester atteignables
// sur mobile, natif ET web, pas seulement sur desktop). "Pourquoi
// Clovis ?" ouvre CatalogueClovis via lib/contexteCatalogue.tsx.

// Exporté (pas seulement local) : MenuHamburgerNatif.tsx et
// MenuHamburgerWeb.tsx réutilisent ce même tableau tel quel, pour ne
// jamais avoir une deuxième liste qui pourrait diverger de celle-ci au
// fil du temps.
//
// Partie 1 navigation mobile (29-30/08/2026) : Bureau retiré d'ici,
// devenu un onglet direct des deux barres mobiles (native ET web, voir
// BarreOngletsNative.tsx/BarreOngletsWeb.tsx).
//
// 30/08/2026, audit navigation, étape 1 : Accueil ajouté (n'avait aucun
// accès côté natif jusqu'ici, signalé par Bourama comme écran orphelin).
// 30/08/2026, étape 2 : Rappels ajouté (EspaceRappels.tsx, écran fini
// mais jusque-là inatteignable nulle part, natif comme web, signalé par
// Bourama). Fonctionnalité dépendante d'un plugin natif (notifications
// programmées) : n'a donc de sens que dans ce menu mobile (natif + web
// mobile), jamais sur PC, où ce menu n'est de toute façon jamais rendu
// (voir MenuHamburgerNatif.tsx/MenuHamburgerWeb.tsx, tous deux
// exclusivement mobiles).
export const SECTIONS_BASE: { icone: LucideIcon; titre: string; sousTitre?: string; href: string }[] = [
  { icone: Home, titre: "Accueil", sousTitre: "Mon espace", href: "/" },
  { icone: Plug, titre: "Connecter Claude", sousTitre: "Utiliser Clovis dans Claude", href: "/connecter-claude" },
  { icone: Settings, titre: "Paramètres", sousTitre: "Profil, confidentialité, capacités du téléphone...", href: "/parametres" },
  { icone: Bell, titre: "Rappels", sousTitre: "Notifications programmées", href: "/rappels" },
];

function LigneSection({ icone: Icone, titre, sousTitre, onClick }: { icone: LucideIcon; titre: string; sousTitre?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
    >
      {/* Conteneur tonal (30/08/2026, tâche 3, Material 3 Expressive) :
          l'icône avait juste une couleur atténuée sur fond transparent,
          sans "containment" -- remplacé par un vrai fond coloré (voir
          --dj-accent-1-conteneur, globals.css) pour signaler visuellement
          que chaque ligne est une action, sans changer la structure de la
          liste ni son comportement. */}
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur">
        <Icone size={17} className="text-dj-accent-1-texte" />
      </span>
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
// MenuHamburgerNatif.tsx (natif) et MenuHamburgerWeb.tsx (web mobile).
// Les deux lui passent la même liste (SECTIONS_BASE), désormais
// identique des deux côtés (étape 1 de l'audit navigation, 30/08/2026).
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
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur">
              <Share2 size={17} className="text-dj-accent-1-texte" />
            </span>
            <span className="flex-1 text-sm text-dj-texte">{copie ? "Copié !" : "Partager"}</span>
          </button>
          <button
            onClick={() => setAvisDeplie((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur">
              <Star size={17} className="text-dj-accent-1-texte" />
            </span>
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
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur">
              <Compass size={17} className="text-dj-accent-1-texte" />
            </span>
            <span className="flex-1 text-sm text-dj-texte">Pourquoi Clovis ?</span>
          </button>
        </div>
      </div>
    </div>
  );
}
