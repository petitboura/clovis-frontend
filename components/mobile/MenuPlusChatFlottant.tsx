"use client";

import { Suspense, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { ContexteRetour } from "@/lib/contexteRetour";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Créé le 03/09/2026, demande Bourama : le bouton "Plus" du tiroir
// mobile du chat plein écran (AppSidebar.tsx) dépliait avant son
// contenu sur place (état local `actionsDeplie` + contexteRetour via
// useFermetureAuRetour) -- mécanisme jugé incorrect par Bourama ("lui
// même n'est pas correct"). Reprend à la place, très exactement, la
// technique de MenuHamburgerNatif.tsx (celle qui marche, la même que
// MenuHamburgerWeb.tsx en plus simple) : ouverture/fermeture pilotées
// par un paramètre d'URL dédié, jamais un état local, `router.push`
// pour ouvrir, `router.back()` pour fermer.
//
// Paramètre d'URL séparé (?panneauChat=plus, jamais ?panneau=plus) :
// ce dernier est déjà lu par MenuHamburgerNatif.tsx/MenuHamburgerWeb.tsx,
// montés en permanence dans AppShell.tsx -- le réutiliser les ouvrirait
// en même temps (invisibles derrière le chat plein écran, z-[110], mais
// montés pour rien quand même). Décision explicite de Bourama (03/09) :
// paramètre à part, même technique.
//
// Enregistrement dans la pile de contexteRetour.tsx (remonterAuSommet,
// pas empiler -- même raison que MenuHamburgerNatif.tsx) : le chat
// plein écran s'enregistre déjà lui-même dans cette pile
// (ChatFlottant.tsx, useFermetureAuRetour(etat === "plein_ecran", ...)).
// Sans cet enregistrement, le bouton retour matériel Android fermerait
// directement le chat au lieu de fermer d'abord ce panneau, qui flotte
// pourtant par-dessus lui. `depiler(id, false)` au nettoyage : jamais de
// history.back() automatique déclenché par ce nettoyage, seul un vrai
// router.back() (via fermerMenu, ou via le bouton retour matériel qui
// appelle directement fermerMenu) change l'URL.
//
// gererRetour={false} sur PanneauFlottant (voir correctif parallèle du
// 03/09/2026 découvert au rebase de ce chantier, commit "history.back()
// parasite qui annule la navigation du menu Plus") : PanneauFlottant
// s'enregistre lui-même dans la même pile par défaut -- comme ce
// composant-ci a déjà sa propre inscription manuelle juste au-dessus
// (remonterAuSommet/depiler, même raison que MenuHamburgerNatif.tsx),
// sans gererRetour={false} il y aurait double enregistrement et le même
// history.back() parasite que ce correctif vient de corriger ailleurs.
//
// z-[150] sur PanneauFlottant : même valeur que celle passée par
// ChatFlottant.tsx à CompteRequisModal pour flotter par-dessus ce même
// chat plein écran (z-[110], voir le correctif du 25/08/2026 dans ce
// fichier) -- gardée cohérente ici plutôt que réinventée.
//
// Bouton déclencheur : reprend le style de ligne du tiroir mobile
// (icône MoreHorizontal + "Plus") qu'il remplace -- seul ce qui se
// passe au clic change.
function MenuPlusChatFlottantInterne({ onNaviguer }: { onNaviguer: (href: string) => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useContext(ContexteRetour);
  const id = useRef(`plus-chat-plein-ecran-${Math.random().toString(36).slice(2)}`).current;

  const ouvert = searchParams.get("panneauChat") === "plus";

  const [monte, setMonte] = useState(ouvert);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  useEffect(() => {
    if (ouvert) {
      setMonte(true);
    } else if (monte) {
      demarrerFermeture(() => setMonte(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'au paramètre d'URL, pas à monte/demarrerFermeture (référence stable de toute façon)
  }, [ouvert]);

  function fermerMenu() {
    router.back();
  }

  // Voir commentaire d'en-tête : simple "réservation de place" dans la
  // pile pour que le bouton retour matériel Android sache que ce
  // panneau est ouvert (par-dessus le chat plein écran, déjà dans la
  // pile), sans poser d'entrée d'historique en plus de celle du routeur
  // Next.
  useEffect(() => {
    if (!ctx) return;
    if (ouvert) {
      ctx.remonterAuSommet(id, fermerMenu);
    }
    return () => ctx.depiler(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fermerMenu a une référence stable (router.back() seul), pas besoin de le lister
  }, [ctx, id, ouvert]);

  function ouvrirMenu() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panneauChat", "plus");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <button
        onClick={ouvrirMenu}
        className={`group relative mt-2 flex w-full items-center gap-2 rounded-xl px-2 transition-colors ${
          ouvert ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
        }`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
        </span>
        <span className="text-sm">Plus</span>
      </button>

      {monte && (
        <PanneauFlottant
          onFerme={fermerMenu}
          entete={<span className="text-sm font-medium text-dj-texte">Plus</span>}
          enSortie={enSortie}
          zIndex="z-[150]"
          gererRetour={false}
        >
          <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} onNaviguer={onNaviguer} />
        </PanneauFlottant>
      )}
    </div>
  );
}

// Wrapper Suspense requis par useSearchParams (même correctif que
// MenuHamburgerNatif.tsx/MenuHamburgerWeb.tsx, 03/09/2026, échec de
// build Vercel sur l'export statique Capacitor).
export function MenuPlusChatFlottant({ onNaviguer }: { onNaviguer: (href: string) => void }) {
  return (
    <Suspense fallback={null}>
      <MenuPlusChatFlottantInterne onNaviguer={onNaviguer} />
    </Suspense>
  );
}
