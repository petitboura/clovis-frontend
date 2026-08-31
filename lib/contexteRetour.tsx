"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

// 31/08/2026, demande Bourama : "le bouton retour du téléphone, toute
// l'appli est comptée comme un tout, donc peu importe où t'es le bouton
// retour ferme l'appli" -- vrai sur le natif Android ET le web mobile
// Android, aucune des deux plateformes n'avait de gestion du bouton
// retour (ni @capacitor/app installé côté natif, ni popstate côté web) :
// une popup de section, le tiroir "Plus", le chat plein écran ou une
// modale ouverts n'avaient rien pour "absorber" le retour, qui fermait
// donc directement l'appli.
//
// Principe : une pile centralisée de "calques" (popup de section,
// sous-menu, tiroir mobile, chat plein écran/mini, modale globale).
// Chaque calque s'enregistre à l'ouverture (empiler) et se désenregistre
// à la fermeture (depiler) via useFermetureAuRetour ci-dessous. Un seul
// point d'entrée -- l'événement natif `backButton` (@capacitor/app) et un
// fallback `popstate` pour le web -- dépile TOUJOURS le calque du dessus
// au lieu de laisser l'appli se fermer, et seulement quand la pile est
// vide, le comportement normal reprend (retour réel / l'appli se
// minimise sur natif, comme n'importe quelle appli Android standard).

type Calque = { id: string; fermer: () => void };

type ContexteRetourValeur = {
  empiler: (id: string, fermer: () => void) => void;
  depiler: (id: string) => void;
  // Réordonne un calque déjà présent au sommet de la pile SANS toucher à
  // l'historique du navigateur -- utilisé quand une fenêtre déjà ouverte
  // est simplement remise au premier plan (voir FenetresSections.tsx),
  // pour que le retour ferme bien la fenêtre visuellement au-dessus, pas
  // la première ouverte.
  remonterAuSommet: (id: string, fermer: () => void) => void;
};

export const ContexteRetour = createContext<ContexteRetourValeur | null>(null);

export function useFournirContexteRetour(): ContexteRetourValeur {
  const pile = useRef<Calque[]>([]);
  // Empêche le handler popstate de réagir à un `history.back()` que NOUS
  // avons déclenché nous-mêmes (fermeture via bouton explicite -- voir
  // depiler ci-dessous) -- sans ça, ce back() programmatique serait
  // interprété comme une pression du bouton retour et fermerait un
  // second calque en plus de celui déjà fermé.
  const ignorerProchainPopstate = useRef(false);

  const empiler = useCallback((id: string, fermer: () => void) => {
    pile.current = [...pile.current.filter((c) => c.id !== id), { id, fermer }];
    if (typeof window !== "undefined") {
      window.history.pushState({ clovisCalqueRetour: true }, "", window.location.href);
    }
  }, []);

  const remonterAuSommet = useCallback((id: string, fermer: () => void) => {
    pile.current = [...pile.current.filter((c) => c.id !== id), { id, fermer }];
  }, []);

  const depiler = useCallback((id: string) => {
    const existait = pile.current.some((c) => c.id === id);
    pile.current = pile.current.filter((c) => c.id !== id);
    // Ne consomme une entrée d'historique que si ce calque en avait
    // vraiment une à consommer (existait dans la pile) -- une fermeture
    // déjà déclenchée par le handler popstate ci-dessous a déjà retiré
    // l'entrée correspondante de `pile.current` avant d'appeler
    // `fermer()` : cet appel-ci (déclenché par le composant qui réagit à
    // son propre changement d'état) arrive alors en second et ne doit
    // rien refaire.
    if (existait && typeof window !== "undefined") {
      ignorerProchainPopstate.current = true;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      if (ignorerProchainPopstate.current) {
        ignorerProchainPopstate.current = false;
        return;
      }
      const sommet = pile.current[pile.current.length - 1];
      if (sommet) {
        pile.current = pile.current.slice(0, -1);
        sommet.fermer();
      }
      // Pile vide : rien à faire de spécial, la navigation par défaut du
      // navigateur a déjà eu lieu de son côté.
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Natif (Capacitor) : le bouton matériel Android est indépendant de
  // l'historique de la WebView -- géré séparément via @capacitor/app.
  // Import dynamique (même convention que AppShell.tsx pour
  // @capacitor/core) : évite de casser l'export statique web si le
  // module n'est pas résolu au build, et évite tout effet sur le web.
  useEffect(() => {
    let abonnement: { remove: () => void } | undefined;
    let annule = false;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", () => {
        const sommet = pile.current[pile.current.length - 1];
        if (sommet) {
          pile.current = pile.current.slice(0, -1);
          sommet.fermer();
          return;
        }
        // Rien d'ouvert : comportement natif normal -- minimise l'appli
        // (convention Android standard) plutôt que de la tuer.
        App.minimizeApp();
      });
      if (annule) {
        handle.remove();
      } else {
        abonnement = handle;
      }
    })();
    return () => {
      annule = true;
      abonnement?.remove();
    };
  }, []);

  return { empiler, depiler, remonterAuSommet };
}

// Hook générique pour un calque simple (sous-menu, tiroir, modale) piloté
// par un seul booléen -- s'enregistre quand `actif` devient vrai, se
// désenregistre quand il redevient faux ou au démontage. `fermer` peut
// changer de référence à chaque rendu (closure sur du state à jour) : on
// la lit via une ref pour ne jamais avoir à réenregistrer le calque juste
// parce que la fonction a été recréée.
export function useFermetureAuRetour(actif: boolean, fermer: () => void) {
  const id = useRef(`calque-${Math.random().toString(36).slice(2)}`).current;
  const ctx = useContext(ContexteRetour);
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;

  useEffect(() => {
    if (!ctx) return;
    if (actif) {
      ctx.empiler(id, () => fermerRef.current());
      return () => ctx.depiler(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, id, actif]);
}
