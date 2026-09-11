"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Check, Download, Maximize2, Minimize2, X, Loader2, LucideIcon } from "lucide-react";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { GardeApercu } from "./GardeApercu";

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
//     tant qu'on scrolle dedans, puis part avec le bloc une fois dépassé).
//     11/09/2026, demande Bourama : mutuellement exclusif avec la rangée
//     du haut (n'apparaît que quand elle sort du champ, voir hautVisible
//     plus bas) et invisible par défaut même dans ce cas -- ne devient
//     visible qu'au survol (desktop) ou au tap (mobile, railActifTactile).
//     Ne se démonte jamais (juste opacity), pas de scroll listener JS
//     custom (IntersectionObserver + sticky natif).
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

  // 11/09/2026, demande Bourama : le rail d'icônes sticky (sans texte) et
  // la rangée de boutons du haut (avec texte) doivent être mutuellement
  // exclusifs -- le rail n'a de sens que quand la rangée du haut est
  // scrollée hors champ. `hautVisible` suit ça via IntersectionObserver
  // sur `topRowRef` (rangée du haut, mode non-plein-écran uniquement --
  // l'en-tête du mode plein écran est fixe dans PanneauFlottant, donc
  // hors sujet ici).
  const topRowRef = useRef<HTMLDivElement | null>(null);
  const [hautVisible, setHautVisible] = useState(true);

  useEffect(() => {
    const cible = topRowRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(([entree]) => setHautVisible(entree.isIntersecting), {
      threshold: 0,
    });
    observateur.observe(cible);
    return () => observateur.disconnect();
    // ouvert/pleinEcran en dépendances : topRowRef ne se (re)monte que
    // quand la rangée du haut existe réellement dans le DOM (repli fermé
    // ou plein écran -> pas de rangée du haut à observer).
  }, [ouvert, pleinEcran]);

  // Sur mobile il n'y a pas de :hover -- "apparition au tap" (demande
  // Bourama, 11/09) : un tap dans la zone du contenu bascule la
  // visibilité du rail, qui se recache tout seul après un délai (même
  // logique que les contrôles d'un lecteur vidéo). Sans effet quand
  // hautVisible=true (rail non pertinent dans ce cas, voir plus bas).
  const [railActifTactile, setRailActifTactile] = useState(false);
  const delaiRailRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function basculerRailTactile() {
    if (hautVisible) return;
    setRailActifTactile((v) => {
      const prochain = !v;
      if (delaiRailRef.current) clearTimeout(delaiRailRef.current);
      if (prochain) {
        delaiRailRef.current = setTimeout(() => setRailActifTactile(false), 3000);
      }
      return prochain;
    });
  }

  useEffect(() => {
    return () => {
      if (delaiRailRef.current) clearTimeout(delaiRailRef.current);
    };
  }, []);

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
        className="my-2 flex w-full max-w-sm animate-dj-fade-in items-center gap-3 rounded-xl border border-dj-bordure bg-dj-surface p-3 text-left transition-colors hover:border-dj-bordure-forte"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dj-surface-haute text-dj-texte">
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

  // 11/09/2026 -- visible seulement quand la rangée du haut a disparu du
  // champ (hautVisible=false), et dans ce cas seulement au survol
  // (desktop) ou après un tap (mobile, voir railActifTactile). Jamais
  // démonté ni display:none (juste opacity + pointer-events), pour une
  // transition fluide et pas de saut de mise en page -- demande explicite
  // de Bourama.
  const railVisible = !hautVisible && railActifTactile;
  // Chaque branche liste TOUTES ses classes opacity/pointer-events (rien
  // de partagé en base) pour éviter un conflit d'ordre entre classes
  // Tailwind contradictoires (pointer-events-auto/none) qui coexisteraient
  // sinon dans la même chaîne.
  const classeRail = `flex flex-col gap-1.5 transition-opacity duration-200 ${
    hautVisible
      ? "opacity-0 pointer-events-none"
      : railVisible
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none group-hover/rail:opacity-100 group-hover/rail:pointer-events-auto"
  }`;

  const contenuPrincipal = (
    <>
      <div ref={topRowRef} className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="truncate text-sm font-medium text-dj-texte">{titre}</span>
        <div className="flex shrink-0 gap-1.5">
          <BoutonsActions avecTexte surAgrandir={() => setPleinEcran((v) => !v)} />
        </div>
      </div>

      <div className="group/rail relative" onClick={basculerRailTactile}>
        {/* Rail d'icônes sticky, en overlay HORS FLUX (absolute inset-0
            plutôt que float-right) -- le float précédent réservait de la
            largeur dans le flux normal et écrasait/compressait le
            contenu qui suit (ex. les boutons Formaté/Brut de
            ContenuMarkdown, qui se retrouvaient visuellement fusionnés
            avec le rail juste au-dessus). L'overlay reprend exactement
            les dimensions du contenu (inset-0) donc `sticky` s'y
            comporte à l'identique (colle en haut tant qu'on scrolle dans
            ce bloc), sans plus jamais toucher à la mise en page du
            contenu en dessous. pointer-events-none sur l'enveloppe
            laisse passer les clics vers le contenu (sélection de texte,
            liens...) partout sauf sur les boutons eux-mêmes. */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className={`sticky top-2 float-right mr-1 ${classeRail}`} onClick={(e) => e.stopPropagation()}>
            <BoutonsActions avecTexte={false} surAgrandir={() => setPleinEcran((v) => !v)} />
            <button onClick={fermer} className="flex h-8 w-8 items-center justify-center rounded-lg border border-dj-bordure bg-dj-surface-haute text-dj-texte-muet hover:text-dj-texte" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        </div>
        <GardeApercu hrefTelechargement={hrefTelechargement}>{enfant}</GardeApercu>
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
        <div className="min-h-0 flex-1 overflow-auto">
          <GardeApercu hrefTelechargement={hrefTelechargement}>{enfant}</GardeApercu>
        </div>
      </PanneauFlottant>
    );
  }

  return <div className="my-2 max-w-full animate-dj-fade-in rounded-xl border border-dj-bordure bg-dj-surface p-2">{contenuPrincipal}</div>;
}
