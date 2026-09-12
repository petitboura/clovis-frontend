"use client";

import { Download } from "lucide-react";
import { telecharger } from "@/lib/telecharger";

// Créé le 12/09/2026, demande Bourama : le vrai téléchargement système
// (lib/telecharger.ts) a besoin d'un onClick, donc d'un composant client
// -- extrait à part pour rester utilisable depuis une page Server
// Component (ex. app/(app)/bibliotheque/[id]/page.tsx, volontairement
// pas "use client" pour le SEO) sans convertir toute la page.
export function BoutonTelechargerFichier({
  url,
  nom,
  className = "",
}: {
  url: string;
  nom: string;
  className?: string;
}) {
  return (
    <button
      onClick={() => telecharger(url, nom)}
      className={
        "flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1a0f06] transition-colors duration-200 ease-cgpt-doux hover:bg-dj-accent-2 " +
        className
      }
    >
      <Download size={15} />
      Télécharger
    </button>
  );
}
