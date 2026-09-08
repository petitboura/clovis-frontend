"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, QrCode, Download } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";

// Créé le 30/08/2026, audit navigation web mobile vs natif, étape 4.
// Complété le 08/09/2026, demande Bourama : sur PC, /telecharger n'offre
// plus de bouton "Télécharger l'APK" direct (voir cette page) mais un QR
// à scanner -- le CTA "Télécharger l'app" y menait tel quel serait
// trompeur (on ne télécharge rien en cliquant depuis un PC). Détection
// légère (même pattern que BoutonFlottantTelecharger.tsx) juste pour ce
// texte, le lien pointe dans les deux cas vers /telecharger qui gère la
// vraie logique d'affichage selon l'appareil.
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
  const [surPc, setSurPc] = useState<boolean | null>(null);

  useEffect(() => {
    setSurPc(!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
      <Smartphone size={22} className="text-dj-texte-muet" />
      <p className="text-sm text-dj-texte-muet">{titre} a besoin de l&apos;app Clovis pour fonctionner.</p>
      <Link
        href="/telecharger"
        aria-label="Accéder à l'application Clovis"
        className="mt-1 flex h-[26px] items-center gap-2 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
      >
        {surPc === null ? (
          <Skeleton as="span" className="h-3 w-28 rounded" />
        ) : (
          <span className="flex animate-dj-fade-in-rapide items-center gap-2">
            {surPc ? <QrCode size={14} /> : <Download size={14} />}
            {surPc ? "Scanner avec ton téléphone" : "Télécharger l'app"}
          </span>
        )}
      </Link>
    </div>
  );
}
