"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

// Rend un bloc ```qcm du markdown -- même famille que ```chart
// (GraphiqueDonnees.tsx), ```carte (CarteMessage.tsx) et ```geometrie
// (SchemaGeometrique.tsx). Ajouté le 12/09/2026 (demande Bourama, volet
// étudiant ScholarFlow AI, item 3 des specs indépendantes) : un QCM lisible
// mais non cliquable ne suffit pas, il faut pouvoir sélectionner une
// réponse et voir la correction s'afficher directement dans le fil.
//
// Schéma JSON attendu :
//   {
//     "question": string,
//     "choix": string[],       // au moins 2 options
//     "reponse": number,       // index (0-based) de la bonne réponse dans "choix"
//     "explication"?: string,  // affichée après la réponse, quel que soit le choix
//   }
//
// HORS SCOPE ICI (voir specs-independantes.md, section 3) : aucun appel
// réseau. La réponse choisie n'est PAS envoyée au backend ni sauvegardée --
// ça dépend de la table d'historique et de l'endpoint de sauvegarde
// (sections 2 et 5, pas encore construites). Ce composant ne fait que de
// l'affichage + de l'état local temporaire à la conversation.
//
// Pas de mécanisme i18n branché sur ce projet à ce jour (voir même constat
// dans EspaceParametres.tsx) : textes fixes en français, comme le reste de
// l'app.

type QCM = {
  question: string;
  choix: string[];
  reponse: number;
  explication?: string;
};

export function QCMInteractif({ code }: { code: string }) {
  const [qcm, setQcm] = useState<QCM | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choixSelectionne, setChoixSelectionne] = useState<number | null>(null);

  // Même principe que CarteMessage.tsx/GraphiqueDonnees.tsx/
  // SchemaGeometrique.tsx : on attend que le texte arrête de changer
  // pendant 500ms avant de tenter le parsing, pour ne pas confondre un
  // JSON encore incomplet (streaming en cours) avec un JSON réellement
  // cassé.
  useEffect(() => {
    const delai = setTimeout(() => {
      try {
        const valeur = JSON.parse(code);
        setQcm(valeur);
        setErreur(null);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(delai);
  }, [code]);

  // Remise à zéro de la sélection si le bloc change de contenu (nouveau
  // QCM généré dans le même message, cas rare mais possible pendant un
  // streaming qui régénère le JSON).
  useEffect(() => {
    setChoixSelectionne(null);
  }, [code]);

  if (!qcm) {
    if (erreur) {
      return (
        <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
          <span className="text-[var(--dj-erreur)]">QCM invalide :</span> format JSON non reconnu.
        </div>
      );
    }
    return (
      <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
        <span className="h-2 w-2 animate-dj-glow rounded-full bg-dj-texte-muet" />
        Préparation de l'exercice...
      </div>
    );
  }

  if (!Array.isArray(qcm.choix) || qcm.choix.length < 2 || typeof qcm.reponse !== "number") {
    return (
      <div className="my-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4 text-xs text-dj-texte-muet">
        QCM incomplet : au moins deux choix et une réponse sont nécessaires.
      </div>
    );
  }

  const aRepondu = choixSelectionne !== null;

  return (
    <div className="my-3 animate-dj-fade-in rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <p className="text-sm font-semibold text-dj-texte">{qcm.question}</p>

      <div className="mt-3 flex flex-col gap-2">
        {qcm.choix.map((option, index) => {
          const estLaBonneReponse = index === qcm.reponse;
          const estSelectionne = index === choixSelectionne;

          let classesEtat = "border-dj-bordure bg-dj-surface-haute hover:border-dj-bordure-forte";
          if (aRepondu) {
            if (estLaBonneReponse) {
              classesEtat = "border-dj-succes bg-dj-succes/10";
            } else if (estSelectionne) {
              classesEtat = "border-[var(--dj-erreur)] bg-[var(--dj-erreur)]/10";
            } else {
              classesEtat = "border-dj-bordure bg-dj-surface-haute opacity-60";
            }
          }

          return (
            <button
              key={index}
              type="button"
              disabled={aRepondu}
              onClick={() => setChoixSelectionne(index)}
              aria-pressed={estSelectionne}
              className={`flex items-center justify-between gap-2 rounded-cgpt-carte border px-3 py-2 text-left text-sm text-dj-texte transition-colors ${classesEtat} ${
                aRepondu ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span>{option}</span>
              {aRepondu && estLaBonneReponse && (
                <CheckCircle2 size={16} className="shrink-0 text-dj-succes" />
              )}
              {aRepondu && estSelectionne && !estLaBonneReponse && (
                <XCircle size={16} className="shrink-0 text-[var(--dj-erreur)]" />
              )}
            </button>
          );
        })}
      </div>

      {aRepondu && qcm.explication && (
        <div className="mt-3 animate-dj-fade-in-rapide rounded-cgpt-carte bg-dj-surface-haute p-3 text-xs text-dj-texte-muet">
          {qcm.explication}
        </div>
      )}
    </div>
  );
}
