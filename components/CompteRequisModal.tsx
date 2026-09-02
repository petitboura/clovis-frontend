"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Bouton } from "@/components/Bouton";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Modal "Compte requis" (09/08, demande Bourama) : toute action qui
// nécessite obligatoirement un compte doit passer par ici plutôt que
// d'afficher un message d'erreur brut. Par défaut pointe vers
// /inscription (pas /connexion) -- décision explicite de Bourama :
// le formulaire par défaut est la création de compte, pas la connexion.
// Un lien discret reste disponible pour qui a déjà un compte.

export function CompteRequisModal({
  texte = "Crée un compte pour continuer.",
  onFerme,
  // z-[100] par défaut (usages historiques : NoteAgent.tsx,
  // CommentairesAgent.tsx, CTACompteRequis.tsx). ChatFlottant.tsx passe
  // explicitement z-[120] (audit 25/08/2026, voir correctif dans ce
  // fichier) car son chat plein écran est en z-[110] -- z-[100] plaçait
  // ce popup derrière, invisible.
  zIndex = "z-[100]",
}: {
  texte?: string;
  onFerme: () => void;
  zIndex?: string;
}) {
  const router = useRouter();

  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : ouverture animée (animate-cgpt-entree-modal) mais fermeture
  // instantanée -- même mécanisme que lib/useFermetureAnimee.ts, déjà
  // utilisé par PanneauFlottant et les 8 popups qui passent par lui.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(onFerme);

  // Fermeture au clavier (audit 25/08/2026, aucune popup du chat ne
  // gérait Echap jusqu'ici).
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermer recrée une fonction stable via demarrerFermeture (useCallback) + onFerme du parent
  }, [onFerme]);

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-black/50 p-4 sm:items-center ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={fermer}
    >
      <div
        className={`w-full max-w-sm rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center shadow-[0_2px_24px_rgba(0,0,0,0.35)] ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={fermer}
          aria-label="Fermer"
          className="float-right text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          <X size={18} />
        </button>

        <p className="mt-2 text-dj-texte">{texte}</p>

        <div className="mt-5 flex flex-col gap-2">
          <Bouton onClick={() => router.push("/inscription")} className="w-full">
            Créer un compte
          </Bouton>
          <button
            onClick={() => router.push("/connexion")}
            className="text-sm text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            Déjà un compte ? Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}
