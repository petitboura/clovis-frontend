"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { BoutonRetour } from "./BoutonRetour";

// Conteneur partagé par les sections de l'app (refonte "Mon espace =
// l'app", 15/08/2026). Remplace le conteneur à onglets d'EspaceClovis.tsx
// (lien "Retour au chat" et barre d'onglets en state local) -- la
// navigation entre sections passe désormais par AppSidebar.tsx (vraies
// routes), plus besoin de rien de tout ça ici.
//
// Fil d'Ariane ajouté puis retiré le même jour (22/08/2026, demande
// Bourama) : à ce niveau (Accueil -> Section, un seul niveau réel), il ne
// faisait que répéter le titre déjà affiché juste en dessous par le h1 --
// aucune vraie hiérarchie à montrer, donc aucune utilité, juste un
// doublon visuel. Un vrai fil d'Ariane garde son sens uniquement là où il
// y a une vraie profondeur -- pas ajouté ici pour cette raison.
//
// Prop `groupe` réintroduite le 22/08/2026 (demande Bourama, sidebar
// regroupée) : ici la profondeur existe vraiment (Personnaliser Clovis ->
// Mes skills), donc la même logique justifie cette fois d'afficher le fil
// d'Ariane, plus une colonne de navigation persistante vers les sections
// soeurs (comme une vraie page de paramètres avec sidebar, pas un popup
// qu'on doit rouvrir pour changer de section).
//
// animate-dj-fade-in retiré le 01/09/2026 (chantier "changement de
// section" brut) : l'entrée ET la sortie de chaque section sont
// désormais pilotées par components/TransitionPage.tsx (AppShell.tsx),
// qui anime tout l'arbre {children} d'un coup -- garder la classe ici en
// plus aurait fait démarrer deux fondus indépendants sur le même
// opacity (celui-ci en CSS, celui de TransitionPage en style inline via
// framer-motion), l'un pouvant couper l'autre en plein milieu.
//
// `soeurs[].icone` reçoit un élément déjà rendu (ex: <ScrollText
// size={16} />), PAS un composant (ex: ScrollText) -- correctif 24/08 :
// chaque page qui appelle SectionPage est un Server Component, et
// SectionPage est un Client Component ("use client" ci-dessus, requis
// pour usePathname). Passer une RÉFÉRENCE de composant (une fonction) à
// travers cette frontière Server -> Client fait planter Next.js
// ("Functions cannot be passed directly to Client Components"), invisible
// en dev mais fatal à la génération statique en production -- un élément
// JSX déjà construit, lui, est sérialisable normalement.
export function SectionPage({
  title,
  children,
  groupe,
}: {
  title: string;
  children: React.ReactNode;
  groupe?: {
    label: string;
    href: string;
    soeurs: { href: string; label: string; icone: React.ReactNode }[];
  };
}) {
  const pathname = usePathname();

  if (!groupe) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6 md:pt-8">
        <h1 className="font-display text-xl font-bold text-dj-texte">{title}</h1>
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 md:pt-8">
      <div className="mb-1 flex items-center gap-1.5 text-sm text-dj-texte-muet">
        <BoutonRetour href={groupe.href} padding="p-0.5" className="-ml-0.5" />
        <Link href={groupe.href} className="transition-colors hover:text-dj-texte">
          {groupe.label}
        </Link>
        <ChevronRight size={14} className="flex-shrink-0" />
        <span className="text-dj-texte">{title}</span>
      </div>
      <h1 className="mb-4 font-display text-xl font-bold text-dj-texte">{title}</h1>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <nav className="hidden w-48 flex-shrink-0 flex-col gap-1 md:flex">
          {groupe.soeurs.map((s) => {
            const actif = pathname === s.href;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                  actif
                    ? "bg-dj-surface-haute font-medium text-dj-texte"
                    : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                }`}
              >
                {s.icone}
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </div>
  );
}
