"use client";

import { useState } from "react";
import { EspaceControleSession } from "./EspaceControleSession";
import { EspaceTempsEcran } from "./EspaceTempsEcran";

/**
 * Écran "Concentration", 26/08/2026 (demande Bourama : brancher Temps
 * d'écran dans le même onglet que Contrôle de session, en deux
 * sous-sections). Nom du grand écran choisi par Claude (les deux
 * sous-sections tournent autour de la concentration de l'étudiant : couper
 * les distractions pendant une session, et voir où part son temps) : facile
 * à renommer si Bourama préfère autre chose, c'est juste ce titre-ci en une
 * seule chaîne dans page.tsx.
 *
 * Même pattern d'onglets que la fusion Dossiers du téléphone dans
 * EspaceBibliotheque.tsx (barre à bordure basse + état `vue` local),
 * repris ici pour rester cohérent avec le reste de l'app.
 */

type SousSection = "session" | "temps-ecran";

export function EspaceConcentration() {
  const [sousSection, setSousSection] = useState<SousSection>("session");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 border-b border-dj-bordure">
        <button
          onClick={() => setSousSection("session")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            sousSection === "session"
              ? "border-dj-accent-1 text-dj-texte"
              : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Contrôle de session
        </button>
        <button
          onClick={() => setSousSection("temps-ecran")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            sousSection === "temps-ecran"
              ? "border-dj-accent-1 text-dj-texte"
              : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Temps d&apos;écran
        </button>
      </div>

      {sousSection === "session" ? <EspaceControleSession /> : <EspaceTempsEcran />}
    </div>
  );
}
