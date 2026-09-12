"use client";

import { useState } from "react";
import { ImageOff, ExternalLink } from "lucide-react";
import { VisionneuseImage } from "./VisionneuseImage";
import { telecharger as telechargerFichier } from "@/lib/telecharger";

// Remplace le <img> par défaut de ReactMarkdown (![alt](url) en markdown).
// Trois problèmes réglés par rapport au <img> nu :
//   1. Saut de layout : rien ne réserve d'espace tant que l'image n'a pas
//      chargé -> les messages en dessous "sautent" au chargement. Ici on
//      démarre invisible (opacity-0) et on ne fait le fondu qu'au onLoad,
//      dans un conteneur qui a déjà sa taille max définie.
//   2. Zoom : clic pour agrandir en plein écran (lightbox), pratique pour
//      lire un diagramme ou un tableau capturé en image.
//   3. Échec de chargement (2026-07-20, bug trouvé par Bourama en test réel
//      -- le modèle avait halluciné une URL d'image, cassée au chargement) :
//      sans onError, l'image restait en opacity-0 pour toujours -> case
//      grise vide, aucun signal que quelque chose s'est mal passé. Fallback
//      explicite désormais : icône + lien pour ouvrir l'URL directement
//      (utile si l'image existe mais que le domaine bloque l'intégration).
export function ImageMessage({ src, alt }: { src?: string; alt?: string }) {
  const [chargee, setChargee] = useState(false);
  const [enErreur, setEnErreur] = useState(false);
  const [ouverte, setOuverte] = useState(false);

  if (!src) return null;

  // 12/09/2026, Bourama : vrai téléchargement système sur Android (au
  // lieu du fetch+blob web ici depuis toujours) -- voir lib/telecharger.ts.
  function telecharger() {
    telechargerFichier(src!, alt || "image");
  }

  if (enErreur) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="my-2 flex w-fit max-w-full animate-dj-fade-in items-center gap-2.5 rounded-xl border border-dj-bordure bg-dj-surface px-3 py-2.5 no-underline text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <ImageOff size={16} className="shrink-0" />
        <span className="min-w-0 truncate text-sm">{alt || "Image indisponible"}</span>
        <ExternalLink size={13} className="ml-1 shrink-0" />
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => chargee && setOuverte(true)}
        className="my-2 block max-h-96 overflow-hidden rounded-xl border border-dj-bordure bg-dj-surface"
        aria-label={alt || "Agrandir l'image"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- source dynamique fournie par le modèle, pas un asset local optimisable */}
        <img
          src={src}
          alt={alt || ""}
          onLoad={() => setChargee(true)}
          onError={() => setEnErreur(true)}
          className={`max-h-96 w-auto transition-opacity duration-500 ${chargee ? "opacity-100" : "opacity-0"}`}
        />
      </button>

      {ouverte && (
        // Consolidé (audit 25/08/2026) dans VisionneuseImage.tsx -- ce
        // fichier était la seule des 4 copies déjà corrigée pour le bouton
        // "Fermer" sans onClick propre, ce correctif vit maintenant dans le
        // composant partagé.
        <VisionneuseImage src={src} alt={alt} onFermer={() => setOuverte(false)} onTelecharger={telecharger} />
      )}
    </>
  );
}
