// 07/09/2026, extrait de components/chat/FenetresSections.tsx (demande
// Bourama : le popup mini du chat doit être déplaçable/redimensionnable
// par tous les bords/coins, "comme les fenêtres de section"). Logique
// remontée ici, à l'identique, pour être réutilisée par les deux --
// FenetresSections.tsx a été réécrit pour s'appuyer sur ce hook au lieu
// de sa propre copie locale, comportement inchangé (voir son propre
// commentaire).

// Les 8 poignées de redimensionnement (22/08/2026, demande Bourama :
// "que je puisse les agrandir en tirant par les côtés ou les angles").
// direction encode quels bords bougent : n/s = haut/bas, e/w = droite/
// gauche, combinés pour les 4 coins.
export const POIGNEES_REDIMENSIONNEMENT: { direction: string; classe: string }[] = [
  { direction: "n", classe: "left-2 right-2 top-0 h-1.5 cursor-ns-resize" },
  { direction: "s", classe: "left-2 right-2 bottom-0 h-1.5 cursor-ns-resize" },
  { direction: "e", classe: "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { direction: "w", classe: "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { direction: "ne", classe: "right-0 top-0 h-3 w-3 cursor-nesw-resize" },
  { direction: "nw", classe: "left-0 top-0 h-3 w-3 cursor-nwse-resize" },
  { direction: "se", classe: "right-0 bottom-0 h-3 w-3 cursor-nwse-resize" },
  { direction: "sw", classe: "left-0 bottom-0 h-3 w-3 cursor-nesw-resize" },
];

export type RectanglePatch = Partial<{ x: number; y: number; width: number; height: number }>;

export function useFenetreDeplacable({
  x,
  y,
  width,
  height,
  largeurMin,
  hauteurMin,
  deplacer,
  redimensionner,
  surDebutGeste,
  surFinGeste,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  largeurMin: number;
  hauteurMin: number;
  deplacer: (x: number, y: number) => void;
  redimensionner: (patch: RectanglePatch) => void;
  // Optionnel (FenetresSections.tsx : monterAuPremierPlan) -- appelé au
  // tout début d'un glissement OU d'un redimensionnement, avant tout
  // calcul. Sans utilité pour une fenêtre unique (le popup mini du chat
  // n'a rien à remonter au-dessus).
  surDebutGeste?: () => void;
  // Optionnel (07/09/2026, popup mini du chat : sauvegarde de la
  // position/taille sur le profil) -- appelé UNE SEULE FOIS à la fin du
  // geste (relâchement), avec le rectangle final calculé directement à
  // partir des valeurs de départ + du dernier déplacement (fermeture
  // JS, PAS l'état React `x`/`y`/`width`/`height` reçus en props
  // ci-dessus, qui peut ne pas encore avoir été mis à jour par React au
  // moment exact du relâchement). Volontairement absent pour
  // FenetresSections.tsx (ces fenêtres ne persistent rien).
  surFinGeste?: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  // Correctif (26/08/2026, retour "pas déplaçable à la main sur mobile") :
  // onMouseDown/mousemove/mouseup ne réagissent pas de façon fiable au
  // doigt sur mobile (au mieux un mousedown synthétique isolé, sans les
  // mousemove qui suivent pendant le geste). Pointer Events
  // (onPointerDown/pointermove/pointerup) unifient souris, doigt et
  // stylet, même logique de calcul, juste la source de l'événement qui
  // change. setPointerCapture garde tous les événements suivants
  // rattachés à cet élément même si le doigt glisse hors de sa zone
  // d'origine (comportement natif du drag, pas garanti sans ça sur mobile).
  function demarrerGlissement(e: React.PointerEvent) {
    // Bouton gauche uniquement : laisse clic droit/milieu tranquilles
    // (le doigt/stylet rapporte toujours button 0, donc jamais bloqué ici).
    if (e.button !== 0) return;
    surDebutGeste?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    const depart = { x: e.clientX, y: e.clientY, fx: x, fy: y };
    let finalX = x;
    let finalY = y;
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      // Garde la fenêtre au moins partiellement visible sur les 4 côtés.
      // Bornes calculées sur la taille d'écran actuelle plutôt qu'une
      // valeur fixe, pour rester correct sur petit comme grand écran.
      finalX = Math.max(-400, Math.min(depart.fx + dx, window.innerWidth - 80));
      finalY = Math.max(0, Math.min(depart.fy + dy, window.innerHeight - 40));
      deplacer(finalX, finalY);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      surFinGeste?.({ x: finalX, y: finalY, width, height });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function demarrerRedimensionnement(e: React.PointerEvent, direction: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    surDebutGeste?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    const depart = { x: e.clientX, y: e.clientY, fx: x, fy: y, fw: width, fh: height };
    let finalRect = { x, y, width, height };
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      const patch: RectanglePatch = {};
      if (direction.includes("e")) {
        patch.width = Math.max(largeurMin, depart.fw + dx);
      }
      if (direction.includes("s")) {
        patch.height = Math.max(hauteurMin, depart.fh + dy);
      }
      if (direction.includes("w")) {
        const nouvelleLargeur = Math.max(largeurMin, depart.fw - dx);
        patch.width = nouvelleLargeur;
        patch.x = depart.fx + (depart.fw - nouvelleLargeur);
      }
      if (direction.includes("n")) {
        const nouvelleHauteur = Math.max(hauteurMin, depart.fh - dy);
        patch.height = nouvelleHauteur;
        patch.y = depart.fy + (depart.fh - nouvelleHauteur);
      }
      finalRect = { ...finalRect, ...patch };
      redimensionner(patch);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      surFinGeste?.(finalRect);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return { demarrerGlissement, demarrerRedimensionnement };
}
