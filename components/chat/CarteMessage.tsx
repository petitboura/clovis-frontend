"use client";

import { useEffect, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";

// Rend un bloc ```carte du markdown -- convention : JSON
//   { "lat": number, "lng": number, "label"?: string }
//
// LIMITE ASSUMÉE : pas de tuiles cartographiques interactives (Mapbox/
// Google Maps JS) ici -- ça demande une clé API à configurer côté
// .env.local + facturation potentielle, décision qui revient à Bourama.
// En attendant, carte stylée cohérente avec la charte + lien direct vers
// Google Maps (fonctionne sans clé, sans dépendance). Mieux vaut ça
// qu'un composant qui a l'air interactif mais ne l'est pas.
type Lieu = { lat: number; lng: number; label?: string };

export function CarteMessage({ code }: { code: string }) {
  const [lieu, setLieu] = useState<Lieu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // CORRECTIF 2026-07-30 (audit UX, même principe que GraphiqueDonnees.tsx
  // et Mermaid.tsx) : avant, un JSON réellement cassé (pas juste encore en
  // train d'arriver pendant le streaming) affichait "Localisation du
  // lieu..." pour toujours, sans jamais de message d'erreur. On attend
  // désormais que le texte arrête de changer pendant 500ms avant de
  // tenter le parsing -- un échec à ce moment-là est une vraie erreur.
  useEffect(() => {
    const delai = setTimeout(() => {
      try {
        setLieu(JSON.parse(code));
        setErreur(null);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(delai);
  }, [code]);

  if (!lieu) {
    if (erreur) {
      return (
        <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
          <span className="text-[var(--dj-erreur)]">Carte invalide :</span> format JSON non reconnu.
        </div>
      );
    }
    return (
      <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
        <span className="h-2 w-2 animate-dj-glow rounded-full bg-dj-texte-muet" />
        Localisation du lieu...
      </div>
    );
  }

  if (typeof lieu.lat !== "number" || typeof lieu.lng !== "number") {
    return (
      <div className="my-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        Coordonnées invalides.
      </div>
    );
  }

  const urlMaps = `https://www.google.com/maps/search/?api=1&query=${lieu.lat},${lieu.lng}`;

  return (
    <a
      href={urlMaps}
      target="_blank"
      rel="noopener noreferrer"
      className="my-3 flex animate-dj-fade-in items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4 transition-colors hover:border-dj-bordure-forte"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dj-surface-haute text-dj-texte">
        <MapPin size={18} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-dj-texte">{lieu.label || "Lieu"}</span>
        <span className="block text-xs text-dj-texte-muet">
          {lieu.lat.toFixed(5)}, {lieu.lng.toFixed(5)}
        </span>
      </span>
      <ExternalLink size={14} className="text-dj-texte-muet" />
    </a>
  );
}
