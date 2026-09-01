"use client";

import { useCallback, useEffect, useState } from "react";

// 17/08 (v2, thème clair/sombre) -- gère le choix de thème de
// l'utilisateur : "systeme" (par défaut, suit prefers-color-scheme),
// "clair" ou "sombre" (forcé, prioritaire sur le système). Persisté en
// localStorage sous CLE_STOCKAGE. Le script anti-flash dans
// app/layout.tsx applique déjà l'attribut data-theme AVANT le premier
// rendu React (sinon flash de l'ancien thème le temps que ce hook se
// monte côté client) -- ce hook ne fait que synchroniser React avec ce
// que ce script a déjà posé, et réagir aux changements ultérieurs
// (bouton ThemeToggle, ou changement du réglage système en direct).
const CLE_STOCKAGE = "clovis-theme";

export type ChoixTheme = "systeme" | "clair" | "sombre";
export type ThemeResolu = "clair" | "sombre";

function lireThemeResolu(): ThemeResolu {
  if (typeof document === "undefined") return "sombre"; // SSR : sans importance, jamais affiché
  const attribut = document.documentElement.dataset.theme;
  if (attribut === "light") return "clair";
  if (attribut === "dark") return "sombre";
  // Mode "systeme" (aucun attribut force, cas par defaut pour la plupart
  // des utilisateurs) : avant ce correctif, on retombait ici directement
  // sur "sombre" sans jamais consulter la vraie preference du telephone,
  // ce qui donnait par exemple une barre d'onglets native toujours noire
  // meme en theme clair systeme (remonte par Bourama, 01/09/2026).
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair";
  }
  return "sombre";
}

function lireChoixStocke(): ChoixTheme {
  if (typeof window === "undefined") return "systeme";
  const stocke = window.localStorage.getItem(CLE_STOCKAGE);
  return stocke === "light" ? "clair" : stocke === "dark" ? "sombre" : "systeme";
}

export function useTheme() {
  const [choix, setChoix] = useState<ChoixTheme>("systeme");
  const [resolu, setResolu] = useState<ThemeResolu>("sombre");

  const appliquerAttribut = (c: ChoixTheme) => {
    const racine = document.documentElement;
    if (c === "systeme") {
      racine.removeAttribute("data-theme");
    } else {
      racine.dataset.theme = c === "clair" ? "light" : "dark";
    }
    // Signal générique pour les composants qui ne peuvent pas suivre
    // les variables CSS en direct (ex. Mermaid.tsx : sa palette "base"
    // calcule des couleurs dérivées via khroma à partir des valeurs
    // fournies -- passer var(--...) y casserait ce calcul, il faut donc
    // relire les couleurs RÉSOLUES et relancer le rendu).
    window.dispatchEvent(new Event("clovis-theme-change"));
  };

  useEffect(() => {
    setChoix(lireChoixStocke());
    setResolu(lireThemeResolu());

    // Si l'utilisateur est en mode "systeme", on doit aussi réagir à un
    // changement de réglage système EN DIRECT (ex. l'OS bascule en mode
    // sombre à 20h) -- sans ça le thème resterait figé sur la valeur lue
    // au chargement de la page jusqu'au prochain rafraîchissement.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangementSysteme = () => {
      if (lireChoixStocke() === "systeme") {
        appliquerAttribut("systeme");
        setResolu(lireThemeResolu());
      }
    };
    media.addEventListener("change", surChangementSysteme);
    return () => media.removeEventListener("change", surChangementSysteme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changerTheme = useCallback((nouveauChoix: ChoixTheme) => {
    setChoix(nouveauChoix);
    if (nouveauChoix === "systeme") {
      window.localStorage.removeItem(CLE_STOCKAGE);
    } else {
      window.localStorage.setItem(CLE_STOCKAGE, nouveauChoix === "clair" ? "light" : "dark");
    }
    appliquerAttribut(nouveauChoix);
    setResolu(lireThemeResolu());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { choix, resolu, changerTheme };
}
