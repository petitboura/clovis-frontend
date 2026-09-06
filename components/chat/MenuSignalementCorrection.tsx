"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, BookOpen, ShieldAlert, Check } from "lucide-react";
import type { TypeCorrectionPedagogique } from "@/lib/api";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

/**
 * Signalement pédagogique élève -> prof (Point 2, Partie 4/5 du chantier
 * "confiance pédagogique", 06/09/2026). Un seul bouton compact (icône
 * drapeau) qui déplie les deux types au tap, plutôt que deux boutons
 * toujours visibles côte à côte -- décision actée dans le plan de
 * travail après constat que la bulle de message déborde vite sur petit
 * écran une fois deux boutons de plus ajoutés à côté du like/dislike
 * existant. Visuellement distinct de ThumbsUp/ThumbsDown (icône et
 * couleur différentes) pour ne jamais confondre les deux mécanismes,
 * entièrement séparés côté backend (voir core/corrections_pedagogiques.py).
 *
 * Type A et B ne prennent aucun texte de l'élève à cette étape (le
 * schéma ne le prévoit pas, voir migrations/2026_09_06_corrections_pedagogiques.sql) :
 * le choix du type EST l'action, la correction de fond viendra plus
 * tard du prof, dans le chat (voir ListeCorrectionsProf.tsx).
 */
export function MenuSignalementCorrection({
  onSignaler,
}: {
  onSignaler: (type: TypeCorrectionPedagogique) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState<TypeCorrectionPedagogique | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(() => setOuvert(false));

  useEffect(() => {
    if (!ouvert) return;
    function onClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer();
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermer recrée une fonction stable via demarrerFermeture (useCallback)
  }, [ouvert]);

  // Confirmation brève (check vert) puis disparition, même esprit que
  // "copié !" ailleurs dans l'app (voir `copie` dans BulleMessage.tsx) --
  // jamais de fermeture brute d'une popup sans retour visuel.
  useEffect(() => {
    if (!envoye) return;
    const t = setTimeout(() => setEnvoye(null), 1600);
    return () => clearTimeout(t);
  }, [envoye]);

  async function choisir(type: TypeCorrectionPedagogique) {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      await onSignaler(type);
      setEnvoye(type);
      fermer();
    } catch {
      // Best effort visuel : en cas d'échec réseau, aucune confirmation
      // ne s'affiche, l'élève peut simplement réessayer -- pas d'alerte
      // bloquante pour une action secondaire comme celle-ci.
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (envoye) {
    return (
      <span className="flex items-center gap-1 rounded-md p-1.5 text-dj-accent-1-texte" aria-label="Signalement envoyé">
        <Check size={14} />
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
        aria-label="Signaler un problème pédagogique"
        aria-expanded={ouvert}
        className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte"
      >
        <Flag size={14} />
      </button>

      {(ouvert || enSortie) && (
        <div
          className={`absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-2 text-left shadow-xl ${
            enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
          }`}
        >
          <button
            type="button"
            disabled={envoiEnCours}
            onClick={() => choisir("A")}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
          >
            <BookOpen size={16} className="mt-0.5 flex-shrink-0 text-dj-accent-1-texte" />
            <span>
              <span className="block text-sm font-medium text-dj-texte">Notion ou méthode incorrecte</span>
              <span className="block text-xs text-dj-texte-muet">
                Ton prof recevra ce message pour corriger directement dans le chat.
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={envoiEnCours}
            onClick={() => choisir("B")}
            className="mt-1 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
          >
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-dj-accent-1-texte" />
            <span>
              <span className="block text-sm font-medium text-dj-texte">Comportement général mal réglé</span>
              <span className="block text-xs text-dj-texte-muet">
                Rien à corriger de la part de ton prof, ce signalement est transmis pour supervision.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
