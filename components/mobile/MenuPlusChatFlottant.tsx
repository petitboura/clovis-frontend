"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { useFermetureAuRetour } from "@/lib/contexteRetour";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Créé le 03/09/2026 (paramètre d'URL + router.push/back, même
// technique que MenuHamburgerWeb.tsx/MenuHamburgerNatif.tsx), corrigé
// le 04/09/2026 : ce bouton "Plus", à l'intérieur du chat plein écran,
// fermait le chat lui-même au lieu d'ouvrir son panneau.
//
// Cause : le tiroir mobile (AppSidebar.tsx, `ouverte`) et le chat plein
// écran (ChatFlottant.tsx, `etat === "plein_ecran"`) s'enregistrent
// tous les deux dans la pile de contexteRetour.tsx via `empiler`, qui
// pose une entrée d'historique par un `window.history.pushState` brut
// (voir contexteRetour.tsx). Ce fichier-ci, lui, pilotait son
// ouverture/fermeture par un vrai `router.push`/`router.back()` de
// Next, or Next (14.2 ici) réécrit/gère en interne son propre suivi
// des entrées d'historique qu'il pose lui-même, et ne "voit" pas les
// entrées posées par le `pushState` brut du dessous (tiroir, chat) :
// au clic sur "Plus", le `router.push` de ce composant faisait perdre
// à Next le compte des entrées non gérées par lui, ce qui refermait au
// passage les deux calques du dessous (tiroir puis chat plein écran)
// au lieu de n'ouvrir que ce panneau par-dessus.
//
// Correctif : ce panneau revient à la même mécanique que le tiroir et
// le chat plein écran juste en dessous de lui dans la pile : état
// local (`ouvert`, plus de paramètre d'URL) + `useFermetureAuRetour`
// (donc `empiler`/`depiler`, jamais `router.push`), pour que les 3
// calques utilisent tous la même méthode et ne se marchent plus dessus.
// Reste un panneau flottant par-dessus le chat (PanneauFlottant,
// inchangé), seul le mécanisme d'ouverture/fermeture change.
//
// `marquerFermetureSansHistorique` (mêmes raisons que
// marquerTiroirSansHistorique/marquerPleinEcranSansHistorique dans
// AppSidebar.tsx) : appelée juste avant `onNaviguer`, qui ferme le
// tiroir et le chat puis navigue vraiment (fermerChatEtNaviguer),
// sans ça, le démontage de ce panneau (conséquence de cette navigation,
// tout l'arbre du chat disparaissant) consommerait quand même son
// entrée d'historique par défaut et annulerait la navigation qui vient
// d'avoir lieu, exactement le même bug que ceux déjà corrigés pour le
// tiroir/le groupe/le menu profil le 03/09/2026.
function MenuPlusChatFlottant({ onNaviguer }: { onNaviguer: (href: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  function fermerMenu() {
    demarrerFermeture(() => setOuvert(false));
  }

  const { marquerFermetureSansHistorique } = useFermetureAuRetour(ouvert, fermerMenu);

  function naviguerEtFermer(href: string) {
    marquerFermetureSansHistorique();
    onNaviguer(href);
  }

  return (
    <div>
      <button
        onClick={() => setOuvert(true)}
        className={`group relative mt-2 flex w-full items-center gap-2 rounded-xl px-2 transition-colors ${
          ouvert ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
        }`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
        </span>
        <span className="text-sm">Plus</span>
      </button>

      {(ouvert || enSortie) && (
        <PanneauFlottant
          onFerme={fermerMenu}
          entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}
          enSortie={enSortie}
          zIndex="z-[150]"
          gererRetour={false}
        >
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} onNaviguer={naviguerEtFermer} />
        </PanneauFlottant>
      )}
    </div>
  );
}

export { MenuPlusChatFlottant };
