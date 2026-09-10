"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Check } from "lucide-react";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

export type ChoixSignalement = {
  visible_question: boolean;
  visible_reponse: boolean;
  visible_conversation: boolean;
  probleme_observe: string | null;
};

/**
 * Signalement pédagogique élève -> prof (refonte du 10/09/2026, demande
 * Bourama -- remplace le choix type A/B par un seul type de signalement).
 * Bouton compact (icône drapeau) qui déplie un formulaire court au tap :
 * l'élève choisit ce qu'il partage (question/réponse/conversation) et
 * peut décrire librement le problème observé, en option. Visuellement
 * distinct de ThumbsUp/ThumbsDown, entièrement séparé côté backend (voir
 * core/signalements.py).
 */
export function MenuSignalementCorrection({
  onSignaler,
}: {
  onSignaler: (choix: ChoixSignalement) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [ouvrirVersHaut, setOuvrirVersHaut] = useState(false);
  const [visibleQuestion, setVisibleQuestion] = useState(true);
  const [visibleReponse, setVisibleReponse] = useState(true);
  const [visibleConversation, setVisibleConversation] = useState(false);
  const [problemeObserve, setProblemeObserve] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(() => setOuvert(false));

  // Hauteur approximative du popup -- sert uniquement à décider du sens
  // d'ouverture avant le premier rendu réel, voir ouvrir() ci-dessous.
  const HAUTEUR_POPUP_ESTIMEE = 260;

  // Même logique que l'ancienne version : corrige le popup qui se
  // faisait couper par le bord de l'interface quand le message signalé
  // est proche du bas (capture Bourama du 07/09/2026). Deux contextes à
  // couvrir : la page complète (limite = la fenêtre) et le widget de
  // chat flottant en mode mini (limite = son propre cadre en
  // overflow-hidden, voir ChatFlottant.tsx).
  function trouverLimiteBasse(el: HTMLElement): number {
    let noeud: HTMLElement | null = el.parentElement;
    while (noeud) {
      const style = window.getComputedStyle(noeud);
      if (/(auto|scroll|hidden)/.test(style.overflowY) || /(auto|scroll|hidden)/.test(style.overflow)) {
        return noeud.getBoundingClientRect().bottom;
      }
      noeud = noeud.parentElement;
    }
    return window.innerHeight;
  }

  function ouvrir() {
    if (ref.current) {
      const rectBouton = ref.current.getBoundingClientRect();
      const limiteBasse = trouverLimiteBasse(ref.current);
      setOuvrirVersHaut(limiteBasse - rectBouton.bottom < HAUTEUR_POPUP_ESTIMEE);
    }
    setOuvert(true);
  }

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
  // "copié !" ailleurs dans l'app (voir `copie` dans BulleMessage.tsx).
  useEffect(() => {
    if (!envoye) return;
    const t = setTimeout(() => setEnvoye(false), 1600);
    return () => clearTimeout(t);
  }, [envoye]);

  async function envoyer() {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      await onSignaler({
        visible_question: visibleQuestion,
        visible_reponse: visibleReponse,
        visible_conversation: visibleConversation,
        probleme_observe: problemeObserve.trim() || null,
      });
      setEnvoye(true);
      fermer();
      setProblemeObserve("");
    } catch {
      // Best effort visuel : en cas d'échec réseau, aucune confirmation
      // ne s'affiche, l'élève peut simplement réessayer.
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
        onClick={() => (ouvert ? fermer() : ouvrir())}
        aria-label="Signaler un problème pédagogique"
        aria-expanded={ouvert}
        className="rounded-md p-1.5 text-dj-texte-muet hover:text-dj-texte"
      >
        <Flag size={14} />
      </button>

      {(ouvert || enSortie) && (
        <div
          className={`absolute right-0 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-3 text-left shadow-xl ${
            ouvrirVersHaut ? "bottom-full mb-2" : "top-full mt-2"
          } ${enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"}`}
        >
          <p className="mb-2 text-sm font-medium text-dj-texte">Signaler un problème</p>
          <p className="mb-2 text-xs text-dj-texte-muet">Ce que tu partages avec ton prof :</p>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-dj-texte">
              <input type="checkbox" checked={visibleQuestion} onChange={(e) => setVisibleQuestion(e.target.checked)} />
              Ma question
            </label>
            <label className="flex items-center gap-2 text-xs text-dj-texte">
              <input type="checkbox" checked={visibleReponse} onChange={(e) => setVisibleReponse(e.target.checked)} />
              La réponse de l'IA
            </label>
            <label className="flex items-center gap-2 text-xs text-dj-texte">
              <input type="checkbox" checked={visibleConversation} onChange={(e) => setVisibleConversation(e.target.checked)} />
              Le fil de la conversation
            </label>
          </div>
          <textarea
            value={problemeObserve}
            onChange={(e) => setProblemeObserve(e.target.value)}
            placeholder="Qu'est-ce que tu as observé comme problème ? (optionnel)"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-dj-bordure bg-dj-surface-haute p-2 text-xs text-dj-texte placeholder:text-dj-texte-muet focus:outline-none"
          />
          <button
            type="button"
            disabled={envoiEnCours}
            onClick={envoyer}
            className="mt-2 w-full rounded-lg bg-dj-accent-1 py-1.5 text-xs font-medium text-dj-accent-1-texte disabled:opacity-50"
          >
            Envoyer le signalement
          </button>
        </div>
      )}
    </div>
  );
}
