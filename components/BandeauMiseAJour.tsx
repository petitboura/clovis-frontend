"use client";

import { Download } from "lucide-react";
import { useMiseAJourDisponible } from "@/lib/useMiseAJourDisponible";

/**
 * Créé le 09/09/2026, demande Bourama : petit bandeau en haut de l'écran
 * d'accueil quand une nouvelle version est disponible (CTA clair à
 * l'ouverture de l'app, en plus de la notification et des points rouges
 * Paramètres/Profil). N'affiche rien sur le web (misAJourDisponible ne
 * peut jamais valoir true hors app mobile, voir useMiseAJourDisponible).
 */
export function BandeauMiseAJour() {
  const { misAJourDisponible, version, telecharger } = useMiseAJourDisponible();

  if (!misAJourDisponible) return null;

  return (
    <div className="flex animate-dj-fade-in-rapide items-center justify-between gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Download size={18} className="flex-shrink-0 text-dj-accent-1" />
        <span className="text-sm text-dj-texte">
          Version {version ?? ""} disponible.
        </span>
      </div>
      <button
        onClick={telecharger}
        className="flex-shrink-0 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
      >
        Télécharger
      </button>
    </div>
  );
}
