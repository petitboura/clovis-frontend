"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Download, Maximize2, Minimize2, X } from "lucide-react";
import hljs from "@/lib/coloration";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Rendu des blocs ```lang ... ``` "code réel" du markdown (les langages
// spéciaux -- mermaid/chart/carte/html -- sont interceptés un niveau plus
// haut, dans le composant `pre` custom de BulleMessage.tsx, et ne
// passent jamais par ici).
//
// Coloration syntaxique : highlight.js appelé directement sur le texte
// brut (pas via un plugin rehype dans la chaîne ReactMarkdown) -- un
// plugin rehype réécrirait l'AST du <code> en spans AVANT que ce
// composant ne le reçoive, ce qui casserait deux choses : la détection
// du langage un niveau au-dessus (mermaid/chart/carte ont besoin du
// texte source intact) et le bouton copier (qui a besoin du texte brut,
// pas du HTML coloré). En gardant le texte brut jusqu'ici, les deux
// restent simples.
//
// Téléchargement/plein écran ajoutés le 2026-07-23 (demande de Bourama :
// même niveau de fonctionnalités qu'un fichier livré seul, voir
// FichierCode.tsx/BlocExpansible.tsx -- mais PAS le même composant : un
// bloc de code inline s'affiche directement dans le texte, jamais replié
// derrière un clic comme un fichier joint). Téléchargement 100% côté
// navigateur (Blob + lien temporaire) : contrairement à un fichier
// généré, il n'y a pas d'URL Supabase ici, juste le texte brut du bloc.
const EXTENSION_PAR_LANGAGE: Record<string, string> = {
  python: "py", javascript: "js", typescript: "ts", xml: "html", css: "css",
  bash: "sh", sql: "sql", java: "java", c: "c", cpp: "cpp", go: "go",
  rust: "rs", php: "php", ruby: "rb", yaml: "yml", markdown: "md", ini: "toml",
  json: "json",
};

export function BlocCode({ langage, code }: { langage: string; code: string }) {
  const [copie, setCopie] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  const html = useMemo(() => {
    try {
      if (langage && hljs.getLanguage(langage)) {
        return hljs.highlight(code, { language: langage }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      // Langage non reconnu ou code encore incomplet (streaming) -- on
      // affiche le texte échappé tel quel plutôt que de planter.
      return code.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    }
  }, [langage, code]);

  function copier() {
    navigator.clipboard.writeText(code).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    });
  }

  function telecharger() {
    const extension = EXTENSION_PAR_LANGAGE[langage] || "txt";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `code.${extension}`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  // Bouton Agrandir/Rétrécir partagé entre vue inline et plein écran
  // (boutonsActions, plus bas) -- seule la fermeture (Rétrécir depuis le
  // plein écran) doit passer par l'animation, pas l'ouverture.
  function basculerPleinEcran() {
    if (pleinEcran) demarrerFermeture(() => setPleinEcran(false));
    else setPleinEcran(true);
  }

  const blocPre = (
    <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
      <code
        className={`hljs language-${langage || "plaintext"}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </pre>
  );

  const boutonClasse =
    "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-dj-texte-muet transition-colors hover:text-dj-texte";

  const boutonsActions = (
    <>
      <button onClick={copier} aria-label="Copier le code" className={boutonClasse}>
        {copie ? (
          <>
            <Check size={12} /> Copié
          </>
        ) : (
          <>
            <Copy size={12} /> Copier
          </>
        )}
      </button>
      <button onClick={telecharger} aria-label="Télécharger le code" className={boutonClasse}>
        <Download size={12} /> Télécharger
      </button>
      <button
        onClick={basculerPleinEcran}
        aria-label={pleinEcran ? "Rétrécir" : "Agrandir"}
        className={boutonClasse}
      >
        {pleinEcran ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        {pleinEcran ? "Rétrécir" : "Agrandir"}
      </button>
    </>
  );

  if (pleinEcran) {
    return (
      <PanneauFlottant
        onFerme={() => demarrerFermeture(() => setPleinEcran(false))}
        pleine
        enSortie={enSortie}
        entete={
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-dj-texte-muet">
              {langage || "texte"}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {boutonsActions}
              <button
                onClick={() => demarrerFermeture(() => setPleinEcran(false))}
                aria-label="Fermer"
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-auto">{blocPre}</div>
      </PanneauFlottant>
    );
  }

  return (
    <div className="dj-bloc-code group/code relative my-3 animate-dj-fade-in overflow-hidden rounded-xl border border-dj-bordure bg-[var(--dj-fond)]">
      <div className="flex items-center justify-between border-b border-dj-bordure px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-dj-texte-muet">
          {langage || "texte"}
        </span>
        <div className="flex items-center gap-2">{boutonsActions}</div>
      </div>
      {blocPre}
    </div>
  );
}
