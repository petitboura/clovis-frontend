"use client";

import { useEffect } from "react";

// Signale que React a fini de monter (voir SplashOuverture.tsx + le
// script inline juste après dans app/layout.tsx). Fait disparaître
// l'écran d'ouverture au bon moment -- quand l'appli est réellement
// prête -- plutôt qu'après une durée fixe devinée à l'avance.
export function SplashPret() {
  useEffect(() => {
    document.dispatchEvent(new Event("clovis:pret"));
  }, []);

  return null;
}
