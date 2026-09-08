"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";

// Créé le 08/09/2026, demande Bourama : sur PC, /telecharger.tsx ne peut
// proposer aucun APK installable -- ce bloc remplace le bouton de
// téléchargement direct par un moyen d'atteindre la page depuis un
// téléphone, seul endroit où le fichier a un sens. Les trois façons
// (scanner, cliquer, copier) cohabitent volontairement plutôt qu'une
// seule : selon le contexte (téléphone posé à côté ou besoin de
// s'envoyer le lien autrement), l'une ou l'autre est la plus pratique.
//
// Composant client séparé (et non inline dans page.tsx, qui reste un
// composant serveur) : seule la partie interactive (QR + copie) a besoin
// du navigateur, le fetch de la release GitHub reste côté serveur.
export function QrTelechargerPc({ url }: { url: string }) {
  const [copie, setCopie] = useState(false);

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papier indisponible (permission refusée, contexte non
      // sécurisé) : le lien reste affiché et cliquable juste en dessous,
      // rien de bloquant pour l'utilisateur.
    }
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-4">
      <div className="rounded-xl bg-white p-3">
        <QRCodeSVG value={url} size={168} level="M" />
      </div>
      <a
        href={url}
        className="break-all text-center text-xs text-dj-texte-muet underline decoration-dj-bordure underline-offset-2 transition-colors hover:text-dj-texte"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={copierLien}
        className="flex items-center gap-2 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-1.5 text-xs font-medium text-dj-texte transition-colors hover:bg-dj-surface"
      >
        {copie ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        {copie ? "Lien copié" : "Copier le lien"}
      </button>
    </div>
  );
}
