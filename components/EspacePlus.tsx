"use client";

import { useRouter } from "next/navigation";
import { Wand2, GraduationCap, Plug, Settings, Briefcase, ChevronRight, type LucideIcon } from "lucide-react";

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
const SECTIONS: { icone: LucideIcon; titre: string; sousTitre?: string; href: string }[] = [
  { icone: Wand2, titre: "Personnaliser Clovis", sousTitre: "Mes skills, ma mémoire, plugins", href: "/personnaliser" },
  { icone: GraduationCap, titre: "Scolarité", sousTitre: "Programme, audits", href: "/scolarite" },
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

export function EspacePlus() {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
        <div className="divide-y divide-dj-bordure">
          {SECTIONS.map((s) => (
            <LigneSection key={s.href} icone={s.icone} titre={s.titre} sousTitre={s.sousTitre} onClick={() => router.push(s.href)} />
          ))}
        </div>
      </div>
    </div>
  );
}
