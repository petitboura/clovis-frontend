"use client";

import { useEffect, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ExternalLink } from "lucide-react";
import { ONGLETS, type OngletId } from "@/components/AppSidebar";
import { useFenetres, TAILLE_MIN } from "@/lib/contexteFenetres";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { ContexteRetour } from "@/lib/contexteRetour";
import { useFenetreDeplacable, POIGNEES_REDIMENSIONNEMENT } from "@/lib/useFenetreDeplacable";
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
  // Correctif (07/09/2026, bug signalé Bourama : "ouvrir en vraie page"
  // rouvrait le chat plein écran) : depiler(cle) ci-dessous consomme par
  // défaut l'entrée d'historique posée par empiler à l'ouverture (appelle
  // history.back()) -- correct pour une fermeture "normale" (bouton
  // Fermer, clic dans le chat). Mais quand cette fenêtre se ferme PARCE
  // QU'une vraie navigation vient d'être déclenchée (ouvrirVraiePage,
  // plus bas), ce history.back() différé (après les 180ms de fondu de
  // fermeture) atterrit sur l'entrée d'historique de la popup, dont
  // l'URL enregistrée est encore /chat (l'URL au moment de l'ouverture)
  // -- il renavigue donc vers /chat et rouvre le chat plein écran
  // par-dessus la page qu'on vient d'ouvrir. Même mécanisme que
  // marquerFermetureSansHistorique (lib/contexteRetour.tsx,
  // useFermetureAuRetour) : ouvrirVraiePage le passe à false juste avant
  // de fermer + naviguer, pour que cette fermeture-là ne consomme rien.
  const consommerHistoriqueRef = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ctxRetour) return;
    consommerHistoriqueRef.current = true;
    ctxRetour.empiler(cle, fermerCettePopup);
    return () => ctxRetour.depiler(cle, consommerHistoriqueRef.current);
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

  // 07/09/2026 : logique de glissement/redimensionnement extraite dans
  // lib/useFenetreDeplacable.ts (réutilisée par le popup mini du chat,
  // voir ChatFlottant.tsx) -- comportement inchangé, monterAuPremierPlan
  // passé en `surDebutGeste` pour garder exactement le même effet qu'avant
  // (remonter cette fenêtre au premier plan dès qu'on commence à la
  // glisser ou à la redimensionner).
  const { demarrerGlissement, demarrerRedimensionnement } = useFenetreDeplacable({
    x,
    y,
    width,
    height,
    largeurMin: TAILLE_MIN.width,
    hauteurMin: TAILLE_MIN.height,
    deplacer: (nx, ny) => deplacer(cle, nx, ny),
    redimensionner: (patch) => redimensionner(cle, patch),
    surDebutGeste: () => monterAuPremierPlan(cle),
  });

  // Bouton "ouvrir en vraie page" (30/08/2026, audit navigation) : ferme
  // cette fenêtre (avec fondu, comme le bouton Fermer) puis navigue vers
  // la vraie page de la section.
  // Correctif 1 (07/09/2026, bug signalé Bourama "ça bug") : appelait
  // aussi fermerChat() (ancien fonctionnement -- à l'époque, ces
  // fenêtres ne pouvaient s'ouvrir que par-dessus le calque fixed
  // inset-0 du chat plein écran overlay, qu'il fallait donc fermer
  // explicitement avant de naviguer, sinon la vraie page se chargeait
  // derrière lui et restait invisible). Depuis l'étape 6 du chantier
  // "chat plein écran = vraie section", ces fenêtres ne s'ouvrent plus
  // QUE depuis la vraie route /chat (AppSidebar.tsx, ouvrirFenetre,
  // desktop uniquement) -- il n'y a donc plus jamais de calque chat à
  // fermer : /chat se démonte normalement comme n'importe quelle page au
  // moment du router.push ci-dessous. Appel retiré.
  // Correctif 2 (07/09/2026, suite -- bug signalé Bourama "ça rouvre le
  // chat plein écran tout seul") : retirer fermerChat() a révélé un
  // second bug resté masqué jusque-là, voir consommerHistoriqueRef
  // plus haut -- marqué à false ici juste avant de fermer + naviguer.
  function ouvrirVraiePage() {
    consommerHistoriqueRef.current = false;
    fermerCettePopup();
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
      {POIGNEES_REDIMENSIONNEMENT.map((p) => (
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

// Monté une seule fois dans AppShell.tsx. Les fenêtres vivent en
// position fixed (z-index 120+, voir plus bas) et persistent
// indépendamment de l'état du chat (fermer/réduire le chat ne les
// referme pas ; seul leur propre bouton Fermer le fait -- ou cliquer
// dans l'interface du chat, qui les ferme TOUTES d'un coup, voir
// fermerToutes dans ChatFlottant.tsx).
// Étape 6 (07/09/2026, chantier "chat plein écran = vraie section") :
// ne s'ouvrent plus que sur desktop, depuis le rail de AppSidebar.tsx
// quand contexteChat=true (donc uniquement sur /chat, plus jamais sur
// mobile -- voir ouvrirFenetre dans AppSidebar.tsx). Rendues en
// position fixed, elles s'affichent déjà au-dessus de n'importe quel
// contenu en flux normal (comme la page /chat elle-même depuis
// l'étape 2, plus l'ancien calque fixed dédié du chat plein écran) --
// z-index inchangé, aucun recalcul nécessaire.
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
  // ChatFlottant.tsx, z-[150]) ont donc toujours de la marge, quelle
  // que soit la durée de la session.
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
