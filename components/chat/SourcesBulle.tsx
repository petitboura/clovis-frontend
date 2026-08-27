"use client";

import { useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { ouvrirPosition } from "./visionneurPositionEvenement";

// Rendu "bête" d'une liste de puces de sources cliquables -- PLUS de
// toggle propre depuis le 26/07 (retour Bourama : les sources d'une
// recherche doivent apparaître directement à la suite du résultat de
// CET outil précis, à l'intérieur de sa propre bulle repliable
// (OutilResultatBulle.tsx), pas empilées à part dans un bloc "Sources"
// global à la fin du message). Ce composant n'est donc plus utilisé de
// façon autonome, il est embarqué par OutilResultatBulle.
//
// Favicon par domaine (service public Google, pas d'appel supplémentaire
// côté notre backend) + indice numéroté en exposant à la fin du titre.
function Favicon({ url }: { url: string }) {
  const [enErreur, setEnErreur] = useState(false);

  if (enErreur) return <ExternalLink size={12} className="shrink-0 text-dj-texte-muet" />;

  let domaine: string;
  try {
    domaine = new URL(url).hostname;
  } catch {
    return <ExternalLink size={12} className="shrink-0 text-dj-texte-muet" />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain=${domaine}`}
      alt=""
      width={12}
      height={12}
      className="shrink-0 rounded-[2px]"
      onError={() => setEnErreur(true)}
    />
  );
}

type Source = {
  titre: string;
  url: string;
  extrait?: string;
  url_extrait?: string;
  reperage?: string;
  position_type?: "page" | "timestamp";
  position_valeur?: number;
  type_mime?: string | null;
};

// Deuxième puce cliquable, distincte de la source (26/08, demande
// Bourama : deux popups séparées -- l'une ouvre le document, l'autre
// montre directement le paragraphe/passage exact utilisé). Un clic
// ouvre un petit popover avec l'extrait ; le lien "Ouvrir à cet endroit"
// N'EST PLUS un <a target="_blank"> vers `url_extrait` (26/08, retour
// Bourama : ça sort de l'app et le fragment #page=/#t= est ignoré par
// le lecteur externe qui prend la main) -- ouvre désormais le
// visionneur EN APP (VisionneurPositionGlobal.tsx), qui affiche
// vraiment la bonne page/le bon instant.
function ExtraitPuce({ source }: { source: Source }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        title="Voir le passage exact"
        className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-2 py-1 text-[12px] text-dj-texte-muet transition-colors hover:text-dj-texte"
      >
        <Quote size={12} className="shrink-0" />
      </button>
      {ouvert && (
        <>
          {/* Zone invisible pour fermer le popover au clic en dehors */}
          <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-1.5 w-64 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond p-2.5 text-[12px] shadow-lg">
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-dj-texte-muet">{source.extrait}</p>
            <button
              type="button"
              onClick={() => {
                setOuvert(false);
                ouvrirPosition({
                  url: source.url,
                  titre: source.reperage ? `${source.titre}, ${source.reperage}` : source.titre,
                  positionType: source.position_type,
                  positionValeur: source.position_valeur,
                  typeMime: source.type_mime,
                });
              }}
              className="mt-2 inline-block text-dj-accent-1 hover:underline"
            >
              Ouvrir à cet endroit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SourcesBulle({ sources, numeroDepart = 1 }: { sources?: Source[]; numeroDepart?: number }) {
  if (!sources || !sources.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {sources.map((source, index) => {
        // Deuxième puce affichée seulement quand un extrait précis existe
        // ET pointe vers un endroit différent de la source elle-même
        // (sinon -- image, note, lien -- un seul clic suffit, voir
        // formater_source_bibliotheque côté backend).
        const aUnParagrapheDistinct =
          !!source.extrait && !!source.url_extrait && source.url_extrait !== source.url;

        return (
          <div key={source.url + index} className="flex items-center gap-1">
            {/* CORRECTIF 2026-08-27 (demande Bourama : "que tout reste en
                popup interne, meme les sites") : toujours un <button> qui
                ouvre le visionneur en app -- plus jamais de <a
                target="_blank"> qui sortirait directement de l'app au
                clic. Le visionneur (VisionneurPositionGlobal.tsx) choisit
                lui-même l'aperçu adapté (document bibliothèque quel que
                soit son type, ou carte de site + bouton explicite pour
                une vraie source web). */}
            <button
              type="button"
              onClick={() =>
                ouvrirPosition({
                  url: source.url,
                  titre: source.titre,
                  positionType: source.position_type,
                  positionValeur: source.position_type ? (source.position_type === "page" ? 1 : 0) : undefined,
                  typeMime: source.type_mime,
                })
              }
              title={source.titre}
              className="flex max-w-[220px] items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1 text-[12px] text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              <Favicon url={source.url} />
              <span className="truncate">{source.titre}</span>
              <sup className="shrink-0 font-semibold text-dj-texte-muet">{numeroDepart + index}</sup>
            </button>
            {aUnParagrapheDistinct && <ExtraitPuce source={source} />}
          </div>
        );
      })}
    </div>
  );
}

