"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";

// Créé le 30/08/2026, audit navigation web mobile vs natif, étape 4.
//
// Message uniforme pour les écrans qui dépendent d'un plugin natif sans
// équivalent web (Contrôle de session, Temps d'écran, Accessibilité,
// Rappels). usePluginNatif.ts ne distingue pas PC et navigateur mobile
// (natif vaut false dans les deux cas), donc ce même bandeau couvre les
// deux à la fois, conformément à la règle de l'audit : une fonction
// disponible seulement sur mobile (natif ou web) ne doit jamais
// apparaître sur PC. Avant cette étape, chacun des 4 écrans écrivait son
// propre texte à la main (repéré comme source de divergence de ton lors
// de l'audit) : un seul endroit désormais, avec en plus un vrai lien
// vers /telecharger plutôt qu'une simple phrase informative.
export function BandeauTelechargerApp({ titre }: { titre: string }) {
  return (
    <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
      <Smartphone size={22} className="text-dj-texte-muet" />
      <p className="text-sm text-dj-texte-muet">{titre} a besoin de l&apos;app Clovis pour fonctionner.</p>
      <Link
        href="/telecharger"
        className="mt-1 flex items-center gap-2 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
      >
        Télécharger l&apos;app
      </Link>
    </div>
  );
}
