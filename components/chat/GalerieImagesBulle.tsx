"use client";

import { ouvrirPosition } from "./visionneurPositionEvenement";

// Galerie d'images trouvées par l'outil rechercher_image (01/09, demande
// Bourama), embarquée par OutilResultatBulle.tsx -- même principe que
// SourcesBulle.tsx (rendu "bête" d'une liste, pas de toggle propre),
// mais en grille de miniatures plutôt qu'en puces de texte, et TOUJOURS
// visible (pas besoin de déplier) : contrairement aux sources d'une
// recherche web, la galerie EST le résultat que l'utilisateur est venu
// chercher.
//
// Clic sur une image -> visionneur en app (VisionneurPositionGlobal.tsx,
// typeMime "image/*"), jamais un nouvel onglet -- même règle que
// SourcesBulle.tsx ("que tout reste en popup interne", 27/08).
type Image = { titre: string; url: string; miniature: string; credit?: string | null };

export function GalerieImagesBulle({ images }: { images?: Image[] }) {
  if (!images || !images.length) return null;

  return (
    <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
      {images.map((image, index) => (
        <button
          key={image.url + index}
          type="button"
          onClick={() =>
            ouvrirPosition({
              url: image.url,
              titre: image.titre,
              typeMime: "image/jpeg",
            })
          }
          title={image.credit ? `${image.titre} — ${image.credit}` : image.titre}
          className="group relative aspect-square overflow-hidden rounded-cgpt-bouton border border-dj-bordure bg-dj-surface"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- image
              externe (Pixabay/Pexels), pas un asset local optimisable par
              next/image */}
          <img
            src={image.miniature}
            alt={image.titre}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}
