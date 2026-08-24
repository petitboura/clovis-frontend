"use client";

import { useState, ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Check, Download, Maximize2, Minimize2, X, Loader2, LucideIcon } from "lucide-react";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Remplace le panneau latéral (retiré, 2026-07-20 -- Bourama a préféré
// revenir au déroulement dans le fil, avec un vrai plein écran plutôt
// qu'une division d'écran). Même composant partagé pour code, widget et
// PDF : chip replié -> déroulé dans le fil -> plein écran, avec les
// mêmes 4 actions partout (Copier optionnel selon le contenu, Télécharger
// optionnel, Agrandir/Rétrécir, Fermer).
//
// Double représentation des actions, demande explicite de Bourama :
//   - En haut du contenu déroulé : boutons AVEC texte (Copier/Télécharger/
//     Agrandir), en bas : bouton Fermer AVEC texte -- lisibles à l'arrivée
//     sur le bloc.
//   - Rail d'icônes SANS texte, position sticky (colle en haut du bloc
//     tant qu'on scrolle dedans, puis part avec le bloc une fois dépassé)
//     -- reste visible même sur un fichier long, sans dépendre d'un
//     scroll listener JS.
export function BlocExpansible({
  titre,
  icone: Icone,
  sousTitre,
  texteACopier,
  hrefTelechargement,
  enfant,
  chargement,
  onPremiereOuverture,
}: {
  titre: string;
  icone: LucideIcon;
  sousTitre: string;
  texteACopier?: string;
  hrefTelechargement?: string;
  enfant: ReactNode;
  chargement?: boolean;
  onPremiereOuverture?: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const [copie, setCopie] = useState(false);
  const [premiereOuvertureFaite, setPremiereOuvertureFaite] = useState(false);

  // 18/08/2026, voir lib/useFermetureAnimee.ts : anime la fermeture du
  // panneau plein écran (PanneauFlottant) -- ne concerne QUE ce mode,
  // pas le repli inline (contenuPrincipal), qui ne passe pas par
  // PanneauFlottant.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  function basculerOuvert() {
    if (!ouvert && !premiereOuvertureFaite) {
      setPremiereOuvertureFaite(true);
      onPremiereOuverture?.();
    }
    setOuvert((v) => !v);
  }

  function copier() {
    if (!texteACopier) return;
    navigator.clipboard.writeText(texteACopier).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  function fermer() {
    setPleinEcran(false);
    setOuvert(false);
  }

  // Barre d'actions -- réutilisée telle quelle en haut du déroulé, dans
  // le rail sticky (icônes seules), et dans l'en-tête plein écran.
  function BoutonsActions({ avecTexte, surAgrandir }: { avecTexte: boolean; surAgrandir: () => void }) {
    const classe = avecTexte
      ? "flex items-center gap-1.5 rounded-lg border border-dj-bordure bg-dj-surface-haute px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
      : "flex h-8 w-8 items-center justify-center rounded-lg border border-dj-bordure bg-dj-surface-haute text-dj-texte-muet hover:text-dj-texte";
    return (
      <>
        {texteACopier && (
          <button onClick={copier} className={classe} aria-label="Copier">
            {copie ? <Check size={14} /> : <Copy size={14} />}
            {avecTexte && (copie ? "Copié" : "Copier")}
          </button>
        )}
        {hrefTelechargement && (
          <a href={hrefTelechargement} target="_blank" rel="noopener noreferrer" className={classe} aria-label="Télécharger">
            <Download size={14} />
            {avecTexte && "Télécharger"}
          </a>
        )}
        <button onClick={surAgrandir} className={classe} aria-label={pleinEcran ? "Rétrécir" : "Agrandir"}>
          {pleinEcran ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {avecTexte && (pleinEcran ? "Rétrécir" : "Agrandir")}
        </button>
      </>
    );
  }

  if (!ouvert) {
    return (
      <button
        onClick={basculerOuvert}
        className="my-2 flex w-full max-w-sm animate-dj-fade-in items-center gap-3 rounded-xl border border-dj-bordure bg-dj-surface-haute p-3 text-left transition-colors hover:border-dj-bordure-forte"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dj-surface text-dj-texte">
          <Icone size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-dj-texte">{titre}</span>
          <span className="block text-[11px] uppercase text-dj-texte-muet">{sousTitre}</span>
        </span>
        {chargement ? <Loader2 size={16} className="shrink-0 animate-spin text-dj-texte-muet" /> : <ChevronDown size={16} className="shrink-0 text-dj-texte-muet" />}
      </button>
    );
  }

  const contenuPrincipal = (
    <>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="truncate text-sm font-medium text-dj-texte">{titre}</span>
        <div className="flex shrink-0 gap-1.5">
          <BoutonsActions avecTexte surAgrandir={() => setPleinEcran((v) => !v)} />
        </div>
      </div>

      <div className="relative">
        {/* Rail d'icônes sticky -- reste visible tant qu'on scrolle dans
            CE bloc précis (sticky se recale par rapport à son propre
            conteneur), pas besoin de JS pour ça. */}
        <div className="sticky top-2 z-10 float-right mr-1 flex flex-col gap-1.5">
          <BoutonsActions avecTexte={false} surAgrandir={() => setPleinEcran((v) => !v)} />
          <button onClick={fermer} className="flex h-8 w-8 items-center justify-center rounded-lg border border-dj-bordure bg-dj-surface-haute text-dj-texte-muet hover:text-dj-texte" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
        {enfant}
      </div>

      <div className="pt-2">
        <button
          onClick={fermer}
          className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
        >
          <ChevronUp size={14} /> Fermer
        </button>
      </div>
    </>
  );

  if (pleinEcran) {
    return (
      <PanneauFlottant
        onFerme={() => demarrerFermeture(fermer)}
        pleine
        enSortie={enSortie}
        entete={
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-dj-texte">{titre}</span>
            <div className="flex shrink-0 gap-1.5">
              <BoutonsActions avecTexte surAgrandir={() => setPleinEcran(false)} />
              <button onClick={() => demarrerFermeture(fermer)} className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte">
                <X size={14} /> Fermer
              </button>
            </div>
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-auto">{enfant}</div>
      </PanneauFlottant>
    );
  }

  return <div className="my-2 max-w-full animate-dj-fade-in rounded-xl border border-dj-bordure bg-dj-surface-haute p-2">{contenuPrincipal}</div>;
}
