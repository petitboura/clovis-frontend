"use client";

import { useEffect } from "react";
import { X, Download } from "lucide-react";

// Zoom plein écran d'image, réutilisé partout où le chat affiche une
// image cliquable (audit 25/08/2026 : ce même overlay était réécrit
// indépendamment 4 fois -- FichierChip.tsx/ImageGenereeChip,
// ImageMessage.tsx, BulleMessage.tsx pieces jointes,
// BarreDeSaisie.tsx image collée avant envoi -- avec, en prime, un bug
// commun à 3 des 4 copies : le bouton "Fermer" n'avait aucun onClick
// propre, il ne fonctionnait que par rebond du clic vers le fond. Un
// seul composant partagé désormais, avec fermeture au clavier (Echap)
// en plus du clic.
export function VisionneuseImage({
  src,
  alt = "",
  onFermer,
  onTelecharger,
}: {
  src: string;
  alt?: string;
  onFermer: () => void;
  /** Bouton de téléchargement affiché uniquement si fourni (FichierChip.tsx
   * et ImageMessage.tsx en ont un ; BulleMessage.tsx et BarreDeSaisie.tsx
   * n'en avaient pas avant non plus -- comportement inchangé). */
  onTelecharger?: () => void;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-dj-fade-in items-center justify-center bg-black/85 p-6"
      onClick={onFermer}
    >
      {onTelecharger && (
        <button
          aria-label="Télécharger"
          onClick={(e) => {
            e.stopPropagation();
            onTelecharger();
          }}
          className="absolute right-16 top-5 text-dj-texte-muet hover:text-dj-texte"
        >
          <Download size={22} />
        </button>
      )}
      <button
        aria-label="Fermer"
        onClick={(e) => {
          e.stopPropagation();
          onFermer();
        }}
        className="absolute right-5 top-5 text-dj-texte-muet hover:text-dj-texte"
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- source dynamique, pas un asset local optimisable */}
      <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
    </div>
  );
}
