"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { ONGLETS, type OngletId } from "@/components/AppSidebar";
import { useFenetres, TAILLE_MIN } from "@/lib/contexteFenetres";
import { MesCodes } from "@/components/MesCodes";
import { EspaceEntrerCode } from "@/components/EspaceEntrerCode";
import { MesComportements } from "@/components/MesComportements";
import { EspaceBibliotheque } from "@/components/EspaceBibliotheque";
import { MaMemoire } from "@/components/MaMemoire";
import { EspaceConnecterClaude } from "@/components/EspaceConnecterClaude";

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
};

const LABEL_PAR_ONGLET: Record<OngletId, { label: string; Icone: (typeof ONGLETS)[number]["Icone"] }> =
  Object.fromEntries(ONGLETS.map((o) => [o.id, { label: o.label, Icone: o.Icone }])) as Record<
    OngletId,
    { label: string; Icone: (typeof ONGLETS)[number]["Icone"] }
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
  const glissement = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const { label, Icone } = LABEL_PAR_ONGLET[ongletId];

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

  return (
    <div
      onPointerDownCapture={() => monterAuPremierPlan(cle)}
      style={{ left: x, top: y, width, height, zIndex: 120 + z }}
      className="fixed flex flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_16px_60px_rgba(0,0,0,0.5)]"
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
          onClick={() => fermer(cle)}
          title="Fermer"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-dj-texte-muet transition-colors hover:bg-dj-surface hover:text-dj-texte"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto w-full max-w-xl">{CONTENU_PAR_ONGLET[ongletId]}</div>
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
  return (
    <>
      {fenetres.map((f) => (
        <FenetreSection key={f.cle} cle={f.cle} ongletId={f.ongletId} x={f.x} y={f.y} width={f.width} height={f.height} z={f.z} />
      ))}
    </>
  );
}
