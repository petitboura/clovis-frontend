"use client";

import { useEffect, useState } from "react";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Porté de djiguigne-frontend/components/BoutonInstaller.tsx, texte
// adapté à Clovis. app/manifest.ts + public/sw.js existent
// désormais (voir ServiceWorkerRegistration.tsx) -- le bouton est
// pleinement fonctionnel, plus seulement inerte-par-défaut.
export function BoutonInstaller() {
  const [evenementInstall, setEvenementInstall] = useState<Event | null>(null);
  const [estIOS, setEstIOS] = useState(false);
  const [dejaInstalle, setDejaInstalle] = useState(false);
  const [instructionsIOS, setInstructionsIOS] = useState(false);
  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : ouverture animée mais fermeture instantanée -- même
  // mécanisme que lib/useFermetureAnimee.ts.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermerInstructions = () => demarrerFermeture(() => setInstructionsIOS(false));

  useEffect(() => {
    setDejaInstalle(window.matchMedia("(display-mode: standalone)").matches);
    setEstIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    function gererPrompt(e: Event) {
      e.preventDefault();
      setEvenementInstall(e);
    }
    window.addEventListener("beforeinstallprompt", gererPrompt);
    return () => window.removeEventListener("beforeinstallprompt", gererPrompt);
  }, []);

  if (dejaInstalle) return null;
  if (!evenementInstall && !estIOS) return null;

  async function installer() {
    if (!evenementInstall) return;
    // @ts-expect-error -- BeforeInstallPromptEvent n'est pas dans le typage TS standard
    await evenementInstall.prompt();
    setEvenementInstall(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={estIOS ? () => setInstructionsIOS(true) : installer}
        className="flex items-center gap-1.5 rounded-cgpt-bouton px-3 py-2 text-sm text-dj-texte-muet transition-colors hover:text-dj-texte"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v13m0 0-4-4m4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Télécharger</span>
      </button>

      {instructionsIOS && (
        <div
          className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center ${
            enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
          }`}
          onClick={fermerInstructions}
        >
          <div
            className={`w-full max-w-sm rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5 text-sm text-dj-texte ${
              enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-base font-bold">Installer Clovis</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-dj-texte-muet">
              <li>
                Appuie sur <span className="text-dj-texte">Partager</span> en bas de Safari
              </li>
              <li>
                Choisis <span className="text-dj-texte">« Sur l&apos;écran d&apos;accueil »</span>
              </li>
            </ol>
            <button
              type="button"
              onClick={fermerInstructions}
              className="mt-4 w-full rounded-cgpt-bouton bg-dj-accent-1 py-2 text-sm font-bold text-[#1A0D02]"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
