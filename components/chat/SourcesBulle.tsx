"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

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

export function SourcesBulle({ sources }: { sources?: { titre: string; url: string }[] }) {
  if (!sources || !sources.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {sources.map((source, index) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.titre}
          className="flex max-w-[220px] items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1 text-[12px] text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          <Favicon url={source.url} />
          <span className="truncate">{source.titre}</span>
          <sup className="shrink-0 font-semibold text-dj-texte-muet">{index + 1}</sup>
        </a>
      ))}
    </div>
  );
}
