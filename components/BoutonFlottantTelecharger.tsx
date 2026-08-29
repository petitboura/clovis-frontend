"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, X } from "lucide-react";

// Créé le 29/08/2026, mission Bourama : rendre l'appli téléchargeable hors
// Play Store. Remplace les liens texte dispersés (page connexion, Paramètres)
// par UN SEUL bouton flottant global, monté une fois dans app/layout.tsx,
// donc visible sur toutes les pages du site dès l'arrivée -- public ET
// dans l'appli connectée.
//
// Trois conditions cumulatives pour s'afficher :
// 1. Navigateur Android (pas iOS/PC) -- pas la peine sur les plateformes où
//    aucun APK direct n'est proposé pour l'instant.
// 2. PAS dans l'appli déjà installée (Capacitor.isNativePlatform() === false)
//    -- même logique que usePluginNatif.ts, mais un simple appel direct
//    suffit ici, pas besoin d'enregistrer un plugin.
// 3. Pas déjà caché par l'utilisateur (mémorisé dans localStorage, clé
//    dédiée -- une fois fermé, ne réapparaît plus jamais sur cet appareil).
const CLE_CACHE = "clovis-telecharger-apk-cache";

export function BoutonFlottantTelecharger() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let annule = false;

    async function verifier() {
      try {
        if (window.localStorage.getItem(CLE_CACHE) === "1") return;
        if (!/Android/i.test(navigator.userAgent)) return;

        const { Capacitor } = await import("@capacitor/core");
        if (annule) return;
        if (Capacitor.isNativePlatform()) return;

        setVisible(true);
      } catch {
        // Capacitor.isNativePlatform() a échoué (ne devrait pas arriver,
        // toujours bundlé) : on ne montre rien plutôt que de risquer
        // d'afficher le bouton à l'intérieur même de l'appli native.
      }
    }

    verifier();
    return () => {
      annule = true;
    };
  }, []);

  function cacher() {
    try {
      window.localStorage.setItem(CLE_CACHE, "1");
    } catch {
      // localStorage indisponible (navigation privée stricte, etc.) :
      // le bouton réapparaîtra à la prochaine visite, tant pis.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[calc(1.25rem+var(--dj-barre-onglets-web,0px))] left-5 z-40 flex animate-dj-fade-in-rapide items-center gap-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-1 pr-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
    >
      <button
        onClick={cacher}
        aria-label="Cacher"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
      >
        <X size={14} />
      </button>
      <Link
        href="/telecharger"
        className="flex items-center gap-2 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
      >
        <Download size={16} />
        Télécharger l&apos;appli
      </Link>
    </div>
  );
}
