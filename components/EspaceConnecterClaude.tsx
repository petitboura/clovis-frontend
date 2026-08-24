"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy } from "lucide-react";

// Guide "Utiliser Clovis dans Claude" (18/08, demande Bourama).
//
// v2 (18/08, même jour) : Bourama a fourni ses propres captures d'écran
// du vrai flux Claude -- remplace les mockups SVG dessinés à la main de
// la v1 (jugés "inutiles"). Les images viennent de
// /public/guide-clovis-claude/, numérotées dans l'ordre réel du parcours
// qu'il a suivi et capturé (2 captures vides fournies par Bourama --
// écrans de transition sans contenu -- écartées, pas de trou dans la
// numérotation ni doublon inventé).
//
// URL du serveur MCP Clovis confirmée par Bourama le 18/08 :
// https://clovis-backend-production.up.railway.app/mcp/espace

const URL_MCP_CLOVIS = "https://clovis-backend-production.up.railway.app/mcp/espace";

export function EspaceConnecterClaude() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Connecte ton compte Clovis à Claude pour que Claude puisse utiliser ce que tu as dans Clovis (ta mémoire,
        tes skills, ta bibliothèque) directement dans vos conversations. Ça se fait une seule fois.
      </p>

      <EtapeGuide numero={1} titre="Ouvre le menu à côté de la zone de texte">
        <p>
          Dans Claude, clique sur le <span className="font-semibold text-dj-texte">+</span> juste à gauche de la
          zone où tu écris ton message.
        </p>
        <Capture
          src="/guide-clovis-claude/1-accueil-bouton-plus.png"
          largeur={461}
          hauteur={447}
          alt="Écran d'accueil de Claude avec la zone de texte et le bouton + à côté"
        />
      </EtapeGuide>

      <EtapeGuide numero={2} titre="Ajoute un connecteur personnalisé">
        <p>
          Dans le menu qui s&apos;ouvre, survole <span className="font-semibold text-dj-texte">Ajouter un connecteur</span>{" "}
          puis clique <span className="font-semibold text-dj-texte">Ajouter un connecteur personnalisé</span>.
        </p>
        <Capture
          src="/guide-clovis-claude/2-menu-ajouter-connecteur.png"
          largeur={577}
          hauteur={320}
          alt="Menu du bouton + avec le sous-menu Ajouter un connecteur ouvert"
        />
        <Capture
          src="/guide-clovis-claude/3-ajouter-connecteur-personnalise.png"
          largeur={286}
          hauteur={39}
          alt="Option Ajouter un connecteur personnalisé mise en évidence"
        />
      </EtapeGuide>

      <EtapeGuide numero={3} titre="Remplis le formulaire">
        <p>
          Un formulaire s&apos;ouvre. Mets <span className="font-semibold text-dj-texte">Clovis</span> dans{" "}
          <span className="font-semibold text-dj-texte">Nom</span>, et colle l&apos;URL ci-dessous dans{" "}
          <span className="font-semibold text-dj-texte">URL du serveur MCP distant</span>.
        </p>
        <UrlACopier />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Capture
            src="/guide-clovis-claude/4-formulaire-vide.png"
            largeur={530}
            hauteur={619}
            alt="Formulaire Ajouter un connecteur personnalisé vide"
          />
          <Capture
            src="/guide-clovis-claude/5-formulaire-rempli.png"
            largeur={532}
            hauteur={612}
            alt="Formulaire rempli avec le nom Clovis et l'URL du serveur MCP"
          />
        </div>
        <p>
          Clique ensuite sur <span className="font-semibold text-dj-texte">Ajouter</span>.
        </p>
      </EtapeGuide>

      <EtapeGuide numero={4} titre="Autorise l'accès à ton compte Clovis">
        <p>
          Claude t&apos;envoie vers Clovis. Connecte-toi à ton compte si besoin, vérifie les accès demandés, puis
          clique <span className="font-semibold text-dj-texte">Autoriser</span>.
        </p>
        <Capture
          src="/guide-clovis-claude/6-autoriser-claude.png"
          largeur={488}
          hauteur={629}
          alt="Écran Clovis « Autoriser Claude ? » avec la liste des accès demandés"
        />
      </EtapeGuide>

      <EtapeGuide numero={5} titre="Vérifie que Clovis est bien activé">
        <p>
          De retour dans Claude, rouvre le <span className="font-semibold text-dj-texte">+</span> à côté de la zone
          de texte, puis <span className="font-semibold text-dj-texte">Connecteurs</span> : Clovis doit apparaître
          dans la liste, activé.
        </p>
        <Capture
          src="/guide-clovis-claude/7-connecteur-actif.png"
          largeur={581}
          hauteur={431}
          alt="Liste des connecteurs avec Clovis activé"
        />
      </EtapeGuide>

      <EtapeGuide numero={6} titre="C'est prêt : demande-lui ce qu'il peut faire" dernier>
        <p>Dans une conversation, tu peux directement demander à Claude ce qu&apos;il peut faire avec Clovis.</p>
        <Capture
          src="/guide-clovis-claude/8-exemple-usage.png"
          largeur={734}
          hauteur={488}
          alt="Exemple de conversation Claude listant ce qu'il peut faire avec Clovis"
        />
      </EtapeGuide>
    </div>
  );
}

function EtapeGuide({
  numero,
  titre,
  dernier = false,
  children,
}: {
  numero: number;
  titre: string;
  dernier?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 animate-dj-fade-in-rapide" style={{ animationDelay: `${(numero - 1) * 60}ms` }}>
      <div className="flex flex-shrink-0 flex-col items-center">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-dj-surface-haute text-sm font-bold text-dj-texte">
          {numero}
        </span>
        {!dernier && <span className="mt-1 w-px flex-1 bg-dj-bordure" />}
      </div>
      <div className={`flex-1 space-y-3 ${dernier ? "" : "pb-4"}`}>
        <h2 className="font-display text-sm font-semibold text-dj-texte">{titre}</h2>
        <div className="space-y-3 text-sm leading-relaxed text-dj-texte-muet">{children}</div>
      </div>
    </div>
  );
}

function UrlACopier() {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(URL_MCP_CLOVIS);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Pas grave si le presse-papier échoue -- l'URL reste affichée à
      // l'écran, copiable à la main.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 overflow-x-auto rounded-xl border border-dj-bordure-forte bg-dj-surface-haute px-3 py-2.5 font-mono text-xs text-dj-texte">
        {URL_MCP_CLOVIS}
      </span>
      <button
        onClick={copier}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-2.5 text-xs font-medium text-dj-texte-muet transition-colors hover:text-dj-texte"
      >
        {copie ? <Check size={14} /> : <Copy size={14} />}
        {copie ? "Copié !" : "Copier"}
      </button>
    </div>
  );
}

function Capture({
  src,
  largeur,
  hauteur,
  alt,
}: {
  src: string;
  largeur: number;
  hauteur: number;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-dj-bordure bg-dj-surface-haute">
      <Image
        src={src}
        width={largeur}
        height={hauteur}
        alt={alt}
        className="h-auto w-full"
        sizes="(max-width: 640px) 100vw, 400px"
      />
    </div>
  );
}
