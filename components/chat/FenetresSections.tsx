"use client";

import { useEffect, useRef, useContext } from "react";
import { useRouter } from "next/navigation";
import { X, ExternalLink } from "lucide-react";
import { ONGLETS, type OngletId } from "@/components/AppSidebar";
import { useFenetres, TAILLE_MIN } from "@/lib/contexteFenetres";
import { useFermerChat } from "@/lib/contexteChat";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { ContexteRetour } from "@/lib/contexteRetour";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { MesComportements } from "@/components/MesComportements";
import { EspaceBibliotheque } from "@/components/EspaceBibliotheque";
import { MaMemoire } from "@/components/MaMemoire";
import { EspaceConnecterClaude } from "@/components/EspaceConnecterClaude";
import { EspaceConcentration } from "@/components/EspaceConcentration";

const AGENT_ID = "clovis";

// Contenu de chaque section (22/08/2026) -- repris tel quel des pages
// app/(app)/*/page.tsx (mêmes composants, mêmes props), MOINS le
// conteneur SectionPage (le titre y fait doublon avec la barre de titre
// de la fenêtre flottante elle-même, voir plus bas).
const CONTENU_PAR_ONGLET: Record<OngletId, React.ReactNode> = {
  bureau: (
    <div className="flex flex-col gap-4">
      <MesCodes />
      <EspaceEntrerCode />
    </div>
  ),
  comportements: <MesComportements agentId={AGENT_ID} />,
  bibliotheque: <EspaceBibliotheque />,
  memoire: <MaMemoire />,
  claude: <EspaceConnecterClaude />,
  // 30/08/2026, audit navigation web mobile vs natif, étape 2 : Concentration
  // ajoutée à ONGLETS (AppSidebar.tsx), donc obligatoire ici aussi (Record
  // exhaustif sur OngletId).
  "controle-session": <EspaceConcentration />,
};

// Reprend label, icône ET route réelle de chaque section (href, déjà
// présent dans ONGLETS) -- href ajouté le 30/08/2026 (audit navigation)
// pour le bouton "ouvrir en vraie page" de l'en-tête, voir plus bas.
const INFOS_PAR_ONGLET: Record<OngletId, { label: string; href: string; Icone: (typeof ONGLETS)[number]["Icone"] }> =
  Object.fromEntries(ONGLETS.map((o) => [o.id, { label: o.label, href: o.href, Icone: o.Icone }])) as Record<
    OngletId,
    { label: string; href: string; Icone: (typeof ONGLETS)[number]["Icone"] }
  >;

// Les 8 poignées de redimensionnement (22/08/2026, demande Bourama :
// "que je puisse les agrandir en tirant par les côtés ou les angles").
// direction encode quels bords bougent : n/s = haut/bas, e/w = droite/
// gauche, combinés pour les 4 coins.
const POIGNEES: { direction: string; classe: string }[] = [
  { direction: "n", classe: "left-2 right-2 top-0 h-1.5 cursor-ns-resize" },
  { direction: "s", classe: "left-2 right-2 bottom-0 h-1.5 cursor-ns-resize" },
  { direction: "e", classe: "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { direction: "w", classe: "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { direction: "ne", classe: "right-0 top-0 h-3 w-3 cursor-nesw-resize" },
  { direction: "nw", classe: "left-0 top-0 h-3 w-3 cursor-nwse-resize" },
  { direction: "se", classe: "right-0 bottom-0 h-3 w-3 cursor-nwse-resize" },
  { direction: "sw", classe: "left-0 bottom-0 h-3 w-3 cursor-nesw-resize" },
];

function FenetreSection({
  cle,
  ongletId,
  x,
  y,
  width,
  height,
  z,
}: {
  cle: string;
  ongletId: OngletId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}) {
  const { fermer, monterAuPremierPlan, deplacer, redimensionner } = useFenetres();
  const router = useRouter();
  const fermerChat = useFermerChat();
  const glissement = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const { label, href, Icone } = INFOS_PAR_ONGLET[ongletId];
  // Fondu d'apparition/disparition (30/08/2026, audit "aucune transition"
  // -- même mécanisme que le chat lui-même, voir useFermetureAnimee.ts et
  // fermerAvecFondu dans lib/contexteChat.tsx). Ne couvre que la fermeture
  // via le propre bouton Fermer de CETTE fenêtre -- "fermer toutes" (clic
  // dans le chat, voir ChatFlottant.tsx) reste un vidage immédiat de tout
  // le tableau de fenêtres, comportement distinct non concerné par cet
  // audit.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  // 31/08/2026, demande Bourama : le bouton retour (natif + web mobile)
  // doit fermer la popup au-dessus au lieu de fermer toute l'appli --
  // voir lib/contexteRetour.tsx. Enregistrement au montage/démontage
  // (première fois qu'elle s'ouvre/quand elle se ferme) ; remonterAuSommet
  // (second effet plus bas, dépendant de `z`) la replace au sommet de la
  // pile de retour à chaque fois qu'elle est remise au premier plan, sans
  // quoi le retour fermerait toujours la première fenêtre ouverte plutôt
  // que celle visuellement au-dessus.
  const ctxRetour = useContext(ContexteRetour);
  const fermerCettePopup = () => demarrerFermeture(() => fermer(cle));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ctxRetour) return;
    ctxRetour.empiler(cle, fermerCettePopup);
    return () => ctxRetour.depiler(cle);
    // Montage/démontage uniquement (cle est stable pour la durée de vie
    // de cette fenêtre) -- volontairement pas de dépendance sur
    // fermerCettePopup, qui change de référence à chaque rendu.
  }, [ctxRetour, cle]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ctxRetour) return;
    // Ne touche PAS l'historique (contrairement à empiler ci-dessus) --
    // se contente de replacer cette fenêtre au sommet de la pile de
    // retour à chaque fois qu'elle est remise au premier plan (z change).
    ctxRetour.remonterAuSommet(cle, fermerCettePopup);
  }, [ctxRetour, cle, z]);

  // Correctif (26/08/2026, retour "pas déplaçable à la main sur mobile") :
  // onMouseDown/mousemove/mouseup ne réagissent pas de façon fiable au
  // doigt sur mobile (au mieux un mousedown synthétique isolé, sans les
  // mousemove qui suivent pendant le geste). Remplacé par les Pointer
  // Events (onPointerDown/pointermove/pointerup), qui unifient souris,
  // doigt et stylet, même logique de calcul, juste la source de
  // l'événement qui change. setPointerCapture garde tous les événements
  // suivants rattachés à cet élément même si le doigt glisse hors de sa
  // zone d'origine (comportement natif du drag, pas garanti sans ça sur
  // mobile).
  function demarrerGlissement(e: React.PointerEvent) {
    // Bouton gauche uniquement : laisse clic droit/milieu tranquilles
    // (le doigt/stylet rapporte toujours button 0, donc jamais bloqué ici).
    if (e.button !== 0) return;
    monterAuPremierPlan(cle);
    e.currentTarget.setPointerCapture(e.pointerId);
    glissement.current = { x: e.clientX, y: e.clientY, fx: x, fy: y };
    function onMove(ev: PointerEvent) {
      if (!glissement.current) return;
      const dx = ev.clientX - glissement.current.x;
      const dy = ev.clientY - glissement.current.y;
      // Garde la fenêtre au moins partiellement visible sur les 4 côtés.
      // AVANT (audit 28/08/2026) : seuls la gauche (-400) et le haut (0)
      // étaient bornés -- rien n'empêchait de la traîner hors écran à
      // droite ou en bas, où son bouton Fermer devenait alors
      // inaccessible (seul recours : "fermer toutes" en cliquant dans le
      // chat, qui ferme aussi les autres fenêtres ouvertes). Bornes
      // calculées sur la taille d'écran actuelle plutôt qu'une valeur
      // fixe, pour rester correct sur petit comme grand écran.
      const nx = Math.max(-400, Math.min(glissement.current.fx + dx, window.innerWidth - 80));
      const ny = Math.max(0, Math.min(glissement.current.fy + dy, window.innerHeight - 40));
      deplacer(cle, nx, ny);
    }
    function onUp() {
      glissement.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function demarrerRedimensionnement(e: React.PointerEvent, direction: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    monterAuPremierPlan(cle);
    e.currentTarget.setPointerCapture(e.pointerId);
    const depart = { x: e.clientX, y: e.clientY, fx: x, fy: y, fw: width, fh: height };
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      const patch: Partial<{ x: number; y: number; width: number; height: number }> = {};
      if (direction.includes("e")) {
        patch.width = Math.max(TAILLE_MIN.width, depart.fw + dx);
      }
      if (direction.includes("s")) {
        patch.height = Math.max(TAILLE_MIN.height, depart.fh + dy);
      }
      if (direction.includes("w")) {
        const nouvelleLargeur = Math.max(TAILLE_MIN.width, depart.fw - dx);
        patch.width = nouvelleLargeur;
        patch.x = depart.fx + (depart.fw - nouvelleLargeur);
      }
      if (direction.includes("n")) {
        const nouvelleHauteur = Math.max(TAILLE_MIN.height, depart.fh - dy);
        patch.height = nouvelleHauteur;
        patch.y = depart.fy + (depart.fh - nouvelleHauteur);
      }
      redimensionner(cle, patch);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Bouton "ouvrir en vraie page" (30/08/2026, audit navigation) : ferme
  // cette fenêtre (avec fondu, comme le bouton Fermer) ET le chat plein
  // écran qui vit en dessous (z-[110], voir ChatFlottant.tsx) avant de
  // naviguer -- sinon la vraie page se charge derrière le chat toujours
  // ouvert et reste invisible. Même raisonnement que
  // naviguerDepuisPlusMobile dans AppSidebar.tsx, pas limité au mobile :
  // le chat plein écran recouvre tout l'écran (fixed inset-0) sur
  // desktop aussi.
  function ouvrirVraiePage() {
    fermerCettePopup();
    fermerChat();
    router.push(href);
  }

  return (
    <div
      onPointerDownCapture={() => monterAuPremierPlan(cle)}
      style={{ left: x, top: y, width, height, zIndex: 120 + z }}
      className={
        "fixed flex flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_16px_60px_rgba(0,0,0,0.5)]" +
        // Fondu d'apparition (mount, reprend l'animation standard des
        // modals du projet) et de disparition (juste avant le vrai
        // retrait du tableau de fenêtres, voir demarrerFermeture
        // ci-dessus) -- demande Bourama (30/08/2026) : "aucune transition".
        (enSortie
          ? " pointer-events-none scale-95 opacity-0 transition-all duration-200 ease-cgpt-doux"
          : " animate-cgpt-entree-modal transition-all duration-200 ease-cgpt-doux")
      }
    >
      <div
        onPointerDown={demarrerGlissement}
        // touch-action: none (26/08/2026, même correctif) : sans ça, le
        // navigateur mobile capte le geste comme un scroll de page avant
        // même que le glissement de la fenêtre ne démarre.
        style={{ touchAction: "none" }}
        className="flex flex-shrink-0 cursor-grab select-none items-center gap-2 border-b border-dj-bordure bg-dj-surface-haute px-3 py-2 active:cursor-grabbing"
      >
        <Icone size={15} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="flex-1 truncate text-sm font-medium text-dj-texte">{label}</span>
        <button
          onClick={ouvrirVraiePage}
          // Correctif (30/08/2026, audit) : stopPropagation sur
          // onPointerDown, même raison que le bouton Fermer juste en
          // dessous -- sans ça, l'en-tête (onPointerDown plus haut) capte
          // l'événement avant que le clic ne s'exécute proprement.
          onPointerDown={(e) => e.stopPropagation()}
          title="Ouvrir en vraie page"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte"
        >
          <ExternalLink size={13} />
        </button>
        <button
          onClick={fermerCettePopup}
          // Correctif (30/08/2026, audit "bouton Fermer capté par le
          // glissement") : l'en-tête a onPointerDown pour le glissement
          // (demarrerGlissement ci-dessus) -- sans stopPropagation ici, un
          // clic sur ce bouton fait remonter l'événement pointerdown
          // jusqu'à l'en-tête AVANT que onClick ne s'exécute, qui appelle
          // setPointerCapture dessus et perturbe le clic. Même correctif
          // déjà en place sur les poignées de redimensionnement
          // (demarrerRedimensionnement, e.stopPropagation() en premier).
          onPointerDown={(e) => e.stopPropagation()}
          title="Fermer"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Correctif (30/08/2026, audit "contenu bridé") : max-w-xl
            retiré -- le contenu utilise maintenant toute la largeur
            réelle de la fenêtre, déjà bornée par le redimensionnement
            (TAILLE_MIN/largeur d'écran, voir contexteFenetres.tsx). */}
        <div className="mx-auto w-full">{CONTENU_PAR_ONGLET[ongletId]}</div>
      </div>
      {POIGNEES.map((p) => (
        <div
          key={p.direction}
          onPointerDown={(e) => demarrerRedimensionnement(e, p.direction)}
          style={{ touchAction: "none" }}
          className={`absolute z-10 ${p.classe}`}
        />
      ))}
    </div>
  );
}

// Monté une seule fois dans AppShell.tsx, au même niveau que ChatFlottant
// (z-[110]) -- les fenêtres vivent au-dessus (z-index 120+) et
// persistent indépendamment de l'état du chat (fermer/réduire le chat ne
// les referme pas ; seul leur propre bouton Fermer le fait -- ou cliquer
// dans l'interface du chat, qui les ferme TOUTES d'un coup, voir
// fermerToutes dans ChatFlottant.tsx).
export function FenetresSections() {
  const { fenetres } = useFenetres();
  // Correctif (28/08/2026, audit) : le z-index affiché n'est plus le
  // compteur brut "z" (monotone, jamais réinitialisé -- il grandit à
  // chaque ouverture/mise au premier plan sur toute la session, et
  // pouvait donc finir, avec l'usage, par dépasser des popups plus
  // prioritaires comme le compte-requis ou le feedback, qui doivent
  // TOUJOURS rester au-dessus de ces fenêtres). Ici, on retrouve juste
  // l'ORDRE relatif des fenêtres actuellement ouvertes (tri sur "z") et
  // on leur redonne un rang borné : 0, 1, 2... -- au maximum (nombre de
  // sections ouvrables - 1), soit 4 avec les 5 sections actuelles.
  // FenetreSection ajoute encore 120 (zIndex: 120 + z, inchangé) donc le
  // rendu final va de 120 à 124 max, jamais au-delà. Les popups qui
  // doivent repasser au-dessus (voir CompteRequisModal dans
  // ChatFlottant.tsx, maintenant z-[150]) ont donc toujours de la marge,
  // quelle que soit la durée de la session.
  const ordonnees = [...fenetres].sort((a, b) => a.z - b.z);
  return (
    <>
      {ordonnees.map((f, index) => (
        <FenetreSection
          key={f.cle}
          cle={f.cle}
          ongletId={f.ongletId}
          x={f.x}
          y={f.y}
          width={f.width}
          height={f.height}
          z={index}
        />
      ))}
    </>
  );
}
