"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { OngletId } from "@/components/AppSidebar";

// Fenêtres flottantes de sections par-dessus le chat plein écran
// (22/08/2026, demande explicite Bourama : "je veux que quand on
// clique, eux s'affichent en fenêtre flottante, sans fermer le chat...
// que le clic sur une section l'affiche par-dessus le chat en popup" --
// remplace le comportement précédent qui fermait le chat plein écran au
// clic sur une section). L'URL ne bouge PAS (décision explicite Bourama)
// -- ces fenêtres n'existent que tant qu'elles sont ouvertes, jamais
// restaurées après un rafraîchissement de page. Plusieurs peuvent être
// ouvertes en même temps, empilées (z croissant), déplaçables ET
// redimensionnables (voir components/chat/FenetresSections.tsx).
//
// 22/08/2026, 3 précisions Bourama :
// 1. Cliquer sur une section DÉJÀ ouverte remonte sa fenêtre existante
//    au premier plan au lieu d'en ouvrir une seconde en double -- voir
//    `ouvrir` ci-dessous.
// 2. Redimensionnables par les bords/coins -- voir `width`/`height` +
//    `redimensionner`.
// 3. Cliquer dans l'interface du CHAT (en dessous des fenêtres) ferme
//    TOUTES les fenêtres d'un coup -- voir `fermerToutes`, appelé
//    depuis ChatFlottant.tsx.

export type FenetreSection = {
  cle: string;
  ongletId: OngletId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

type ContexteFenetresValeur = {
  fenetres: FenetreSection[];
  ouvrir: (ongletId: OngletId) => void;
  fermer: (cle: string) => void;
  fermerToutes: () => void;
  monterAuPremierPlan: (cle: string) => void;
  deplacer: (cle: string, x: number, y: number) => void;
  redimensionner: (cle: string, patch: Partial<Pick<FenetreSection, "x" | "y" | "width" | "height">>) => void;
};

export const ContexteFenetres = createContext<ContexteFenetresValeur | null>(null);

// Décalage en cascade pour que les fenêtres ouvertes successivement ne
// se superposent pas exactement (comme un vrai gestionnaire de fenêtres).
const PAS_CASCADE = 32;
const POSITION_BASE = { x: 80, y: 70 };

// "bibliotheque" occupe tout l'espace disponible sur sa vraie page --
// une fenêtre plus large lui va mieux. Source unique (réutilisée par
// FenetresSections.tsx pour le rendu).
export const ONGLETS_LARGES = new Set<OngletId>(["bibliotheque"]);
const TAILLE_NORMALE = { width: 480, height: 560 };
const TAILLE_LARGE = { width: 760, height: 640 };
export const TAILLE_MIN = { width: 320, height: 280 };

// Correctif (01/09/2026, signalé Bourama : popups qui ne s'ouvrent
// jamais côté web mobile et appli native) : crypto.randomUUID() n'est
// pas garanti disponible partout (certains WebView Android plus
// anciens ne l'ont pas) : si absent, l'appel jette une erreur au
// moment même de créer la fenêtre, qui échoue alors silencieusement à
// chaque fois sur l'appareil concerné, sans rien afficher. Repli sur un
// identifiant simple (pas besoin d'un vrai UUID ici, juste une clé
// unique et stable) quand la fonction native manque.
function idFenetre(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fenetre-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useFournirFenetres(): ContexteFenetresValeur {
  const [fenetres, setFenetres] = useState<FenetreSection[]>([]);
  // Compteur de z monotone (jamais réutilisé) plutôt qu'un simple index
  // de tableau -- sinon "monter au premier plan" devrait réordonner tout
  // le tableau à chaque clic, ce qui perturberait le rendu/les refs des
  // fenêtres déjà ouvertes pour rien.
  const prochainZ = useRef(1);
  // Compte les fenêtres déjà ouvertes depuis le montage (pas la longueur
  // du tableau courant, qui redescend quand on en ferme) -- garantit que
  // la cascade continue de progresser même après avoir fermé/rouvert.
  const nbOuvertures = useRef(0);

  const ouvrir = useCallback((ongletId: OngletId) => {
    setFenetres((f) => {
      // Déjà ouverte : on la remonte au premier plan plutôt que d'en
      // ouvrir une deuxième (demande Bourama du 22/08).
      const existante = f.find((fen) => fen.ongletId === ongletId);
      if (existante) {
        const z = prochainZ.current++;
        return f.map((fen) => (fen.cle === existante.cle ? { ...fen, z } : fen));
      }
      const n = nbOuvertures.current++;
      const z = prochainZ.current++;
      const tailleVoulue = ONGLETS_LARGES.has(ongletId) ? TAILLE_LARGE : TAILLE_NORMALE;
      // Correctif (28/08/2026, audit) : AVANT, taille et position
      // d'ouverture étaient toujours fixes (480x560 ou 760x640, position
      // 80/70 + cascade), sans tenir compte de la largeur d'écran. Sur
      // téléphone (~375-414px de large), la fenêtre démarrait déjà en
      // grande partie hors écran dès l'ouverture, avant tout glissement --
      // gênant depuis que le glissement/redimensionnement tactile marche
      // (26/08/2026). Ici : la taille est plafonnée à l'espace réellement
      // disponible (avec 24px de marge, jamais sous TAILLE_MIN), et la
      // position de départ (cascade classique sur grand écran) est ramenée
      // dans l'écran si besoin -- mêmes bornes que le glissement à la main
      // (voir components/chat/FenetresSections.tsx).
      const largeurEcran = window.innerWidth;
      const hauteurEcran = window.innerHeight;
      const width = Math.max(TAILLE_MIN.width, Math.min(tailleVoulue.width, largeurEcran - 24));
      const height = Math.max(TAILLE_MIN.height, Math.min(tailleVoulue.height, hauteurEcran - 24));
      const xCascade = POSITION_BASE.x + (n % 6) * PAS_CASCADE;
      const yCascade = POSITION_BASE.y + (n % 6) * PAS_CASCADE;
      const x = Math.min(xCascade, Math.max(12, largeurEcran - width - 12));
      const y = Math.min(yCascade, Math.max(12, hauteurEcran - height - 12));
      return [
        ...f,
        {
          cle: idFenetre(),
          ongletId,
          x,
          y,
          width,
          height,
          z,
        },
      ];
    });
  }, []);

  const fermer = useCallback((cle: string) => {
    setFenetres((f) => f.filter((fen) => fen.cle !== cle));
  }, []);

  const fermerToutes = useCallback(() => {
    setFenetres((f) => (f.length === 0 ? f : []));
  }, []);

  const monterAuPremierPlan = useCallback((cle: string) => {
    setFenetres((f) => {
      const z = prochainZ.current++;
      return f.map((fen) => (fen.cle === cle ? { ...fen, z } : fen));
    });
  }, []);

  const deplacer = useCallback((cle: string, x: number, y: number) => {
    setFenetres((f) => f.map((fen) => (fen.cle === cle ? { ...fen, x, y } : fen)));
  }, []);

  const redimensionner = useCallback(
    (cle: string, patch: Partial<Pick<FenetreSection, "x" | "y" | "width" | "height">>) => {
      setFenetres((f) => f.map((fen) => (fen.cle === cle ? { ...fen, ...patch } : fen)));
    },
    []
  );

  return { fenetres, ouvrir, fermer, fermerToutes, monterAuPremierPlan, deplacer, redimensionner };
}

export function useFenetres() {
  const ctx = useContext(ContexteFenetres);
  if (!ctx) throw new Error("useFenetres doit être utilisé sous ContexteFenetres.Provider");
  return ctx;
}
