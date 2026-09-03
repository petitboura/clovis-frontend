"use client";

import { ReactNode, useEffect } from "react";
import { useFermetureAuRetour } from "@/lib/contexteRetour";

// Panneau flottant (20/08/2026, demande Bourama : "il y a plein de plein
// écran qui sont comme ça, des carrés, des trucs plats -- change") :
// remplace le pattern `fixed inset-0 bg-dj-fond` (aplat édge-à-édge, sans
// coins ni profondeur) par le vrai langage "carte modale" déjà établi
// ailleurs dans l'app (voir CompteRequisModal.tsx) -- fond assombri en
// retrait, carte flottante à coins légèrement irréguliers
// (rounded-cgpt-carte), ombre, animation cgpt-entree-modal. Composant
// partagé plutôt que dupliqué à chaque écran, pour que toute future
// évolution de ce langage visuel se fasse à un seul endroit.
//
// Volontairement plus large/haut qu'une carte de confirmation classique
// (max-w-3xl, max-h-[88vh]) puisque ces panneaux contiennent un vrai
// espace d'édition (texte long, formulaire), pas juste un message court.

export function PanneauFlottant({
  children,
  onFerme,
  entete,
  large = false,
  pleine = false,
  // 18/08/2026, voir lib/useFermetureAnimee.ts : true pendant les
  // ~180ms où ce panneau doit encore être monté pour jouer son
  // animation de sortie, alors que la condition d'affichage "réelle"
  // côté appelant est déjà retombée à false. onFerme, lui, reste la
  // fonction de fermeture RÉELLE (celle qui finit par démonter) --
  // c'est au hook, pas à ce composant, de décider quand l'appeler.
  enSortie = false,
  // 03/09/2026, correctif bug "clique Accueil/Paramètres/Rappels/Connecter
  // Claude dans le menu Plus, ça ne va nulle part" -- ce panneau
  // s'enregistrait TOUJOURS lui-même dans la pile de contexteRetour.tsx
  // (juste en dessous, `useFermetureAuRetour`), y compris pour
  // MenuHamburgerWeb.tsx (qui explicitement n'en a pas besoin, voir son
  // en-tête) et MenuHamburgerNatif.tsx (qui a déjà SA PROPRE inscription
  // manuelle dans la même pile, via remonterAuSommet/depiler). Dans les
  // deux cas la fermeture par navigation (router.push/replace vers la
  // page cible) déclenchait, au démontage de ce panneau, un
  // `ctx.depiler(id, true)` par défaut -- donc un `history.back()` en
  // plus, qui annulait la navigation qui venait tout juste d'avoir lieu.
  // `gererRetour = false` permet à un appelant qui gère déjà lui-même
  // (ou n'a besoin d'aucune) inscription dans cette pile de désactiver
  // celle-ci ici, sans toucher aux 8 autres popups qui en dépendent
  // (comportement par défaut inchangé, `gererRetour = true`).
  // MenuPlusChatFlottant.tsx (même jour) a exactement le même besoin
  // que MenuHamburgerNatif.tsx (sa propre inscription manuelle via
  // remonterAuSommet/depiler) : passe aussi gererRetour={false}.
  gererRetour = true,
  // 03/09/2026, ajouté pour MenuPlusChatFlottant.tsx (même besoin et
  // même convention que le prop zIndex de CompteRequisModal.tsx) : z-50
  // par défaut, inchangé pour les appelants existants -- un appelant qui
  // doit flotter par-dessus le chat plein écran (z-[110], voir
  // ChatFlottant.tsx) passe explicitement une valeur plus haute.
  zIndex = "z-50",
}: {
  children: ReactNode;
  onFerme?: () => void;
  entete?: ReactNode;
  large?: boolean;
  /** Pour les éditeurs qui ont besoin de presque tout l'espace de travail
   * (canvas de dessin, éditeur de code) : garde la carte flottante (coins,
   * ombre, fond assombri) mais avec beaucoup plus de place qu'un panneau de
   * formulaire classique, plutôt que revenir à l'aplat edge-to-edge. */
  pleine?: boolean;
  enSortie?: boolean;
  /** Voir commentaire ci-dessus (03/09/2026). À false pour un appelant qui
   * gère déjà lui-même son inscription dans la pile de contexteRetour.tsx
   * (ou n'en a besoin d'aucune), pour éviter un double enregistrement et
   * le history.back() parasite qui en découle à la fermeture. */
  gererRetour?: boolean;
  zIndex?: string;
}) {
  // Bouton retour matériel Android / popstate web mobile (31/08/2026,
  // suite de lib/contexteRetour.tsx -- même raisonnement que
  // MenuHamburgerNatif.tsx et PaletteCommandes.tsx) : couvre en un seul
  // endroit les 8 popups qui passent par ce wrapper (MesComportements,
  // EspaceDossiers, BlocExpansible, BarreDeSaisie, EditeurMathsRiche,
  // CanvasDessin, BlocCode...), qui n'étaient pas encore raccordées à la
  // pile alors que ce mécanisme existe déjà pour le menu hamburger et la
  // palette de commandes.
  useFermetureAuRetour(gererRetour && !!onFerme, onFerme ?? (() => {}));

  // Fermeture au clavier (audit 25/08/2026 : aucune popup du chat ne
  // gérait Echap jusqu'ici). Couvre en un seul endroit les 8 composants
  // qui passent par ce wrapper.
  useEffect(() => {
    if (!onFerme) return;
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFerme?.();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFerme]);

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6 ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={onFerme}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full ${
          pleine ? "max-w-6xl max-h-[94vh]" : large ? "max-w-4xl max-h-[88vh]" : "max-w-2xl max-h-[88vh]"
        } flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_8px_40px_rgba(0,0,0,0.45)] ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
      >
        {entete && <div className="flex-shrink-0 border-b border-dj-bordure px-5 py-3 sm:px-6">{entete}</div>}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
