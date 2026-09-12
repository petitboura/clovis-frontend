"use client";

import { Network } from "lucide-react";
import { Mermaid } from "./Mermaid";
import type { BrancheMentale, FicheCarteMentaleData } from "./FicheRevision";

// Sous-composant de FicheRevision.tsx (voir ce fichier pour le contexte
// général, le schéma JSON complet et ce qui est hors scope). Affiche une
// carte mentale : { racine, branches: [{ texte, enfants? }] }.
//
// Choix : s'appuyer sur mermaid (déjà une dépendance du projet -- voir
// Mermaid.tsx et le case "mermaid" de BulleMessage.tsx), qui a un type
// de diagramme "mindmap" natif depuis longtemps avant la version 11.16
// utilisée ici. Mermaid.tsx gère déjà le rendu, le thème (clair/sombre)
// et le cycle de vie SSR/streaming -- plus robuste que réécrire un
// layout d'arbre à la main pour un seul type de fiche parmi cinq.
// On se contente de traduire {racine, branches} en syntaxe mindmap.

// Chaque libellé est entouré de guillemets doubles pour rester robuste
// aux caractères spéciaux ("(", ":", etc.) que peut produire un LLM --
// règle documentée par mermaid pour tout libellé contenant un caractère
// spécial. Un guillemet interne est remplacé par une apostrophe simple
// (mermaid n'accepte pas de guillemet échappé dans un libellé déjà entre
// guillemets). Vérifié aussi (issue mermaid-js/mermaid #213, #6396) :
// un libellé cité SANS forme explicite ([...]) est ambigu pour le
// parseur -- chaque branche reçoit donc un identifiant unique (n1, n2...)
// suivi de son libellé entre crochets, comme le fait la doc mermaid pour
// tout nœud avec forme explicite ; seule la racine garde la forme
// cercle root((...)) de l'exemple officiel.
function texteSecurise(texte: string): string {
  return `"${texte.replace(/\n/g, " ").replace(/"/g, "'").trim()}"`;
}

function ajouterBranche(branche: BrancheMentale, niveau: number, lignes: string[], compteur: { n: number }) {
  compteur.n += 1;
  lignes.push(`${"  ".repeat(niveau)}n${compteur.n}[${texteSecurise(branche.texte)}]`);
  (branche.enfants || []).forEach((enfant) => ajouterBranche(enfant, niveau + 1, lignes, compteur));
}

function construireDefinition(fiche: FicheCarteMentaleData): string {
  const lignes = ["mindmap", `  root((${texteSecurise(fiche.racine)}))`];
  const compteur = { n: 0 };
  fiche.branches.forEach((branche) => ajouterBranche(branche, 2, lignes, compteur));
  return lignes.join("\n");
}

export function FicheCarteMentale({ fiche }: { fiche: FicheCarteMentaleData }) {
  return (
    <div className="my-3 animate-dj-fade-in rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dj-accent-1-conteneur text-dj-accent-1-texte">
          <Network size={14} />
        </span>
        <p className="text-sm font-semibold text-dj-texte">{fiche.titre || "Carte mentale"}</p>
      </div>
      <Mermaid definition={construireDefinition(fiche)} />
    </div>
  );
}
