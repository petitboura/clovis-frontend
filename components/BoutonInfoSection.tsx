"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Créé le 01/09/2026, correctif (Bourama : "les descriptions de section
// toujours affichées, c'est pas la norme mobile").
//
// Norme suivie (Android Developers, guide "Settings") : "si le libellé
// suffit tout seul, n'ajoute pas de texte secondaire ; si un réglage a
// besoin d'une explication plus longue, ajoute une description sur un
// second écran". Motif exact ("infotip", eBay/Balsamiq) : petit bouton
// "i" à côté du titre -> bulle courte au tap -> lien "En savoir plus"
// vers le second écran (ici : Aide et support, voir
// components/EspaceParametres.tsx, vue "aide").
//
// Remplace, sur les écrans concernés, le paragraphe
// `<p className="mt-1 text-xs text-dj-texte-muet">...</p>` qui suivait
// systématiquement le titre <h2>. Le texte lui-même ne change pas, voir
// lib/aideSections.tsx (source unique, lue aussi par la page Aide et
// support pour ne jamais diverger).
//
// Lien profond vers la bonne rubrique (pas juste la liste générale) :
// /parametres?aide=<id>, lu par EspaceParametres.tsx pour ouvrir
// directement la vue "aide" ET scroller/mettre en avant la rubrique --
// EspaceParametres.tsx n'a pas de route par écran (état interne `vue`),
// d'où le paramètre de requête plutôt qu'une ancre de page classique.
export function BoutonInfoSection({ rubriqueId, texteCourt }: { rubriqueId: string; texteCourt: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : cette bulle n'avait qu'une animation d'entrée -- même
  // mécanisme que lib/useFermetureAnimee.ts.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(() => setOuvert(false));

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
        aria-label="Plus d'informations sur cette section"
        aria-expanded={ouvert}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
      >
        <Info size={14} />
      </button>

      {(ouvert || enSortie) && (
        <>
          {/* Zone invisible pour fermer au clic à l'extérieur, même motif
              que les autres popovers légers de l'app (pas de backdrop
              plein écran ici, la bulle est petite et contextuelle). */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={fermer}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            className={`absolute left-0 top-full z-40 mt-2 w-64 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-3 text-left shadow-xl ${
              enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
            }`}
          >
            <p className="text-xs leading-relaxed text-dj-texte-muet">{texteCourt}</p>
            <Link
              href={`/parametres?aide=${rubriqueId}`}
              onClick={fermer}
              className="mt-2 inline-block text-xs font-medium text-dj-accent-1-texte hover:underline"
            >
              En savoir plus
            </Link>
          </div>
        </>
      )}
    </span>
  );
}
