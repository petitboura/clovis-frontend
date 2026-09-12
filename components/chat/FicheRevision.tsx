"use client";

import { useEffect, useState } from "react";
import { FicheFormules } from "./FicheFormules";
import { FicheDates } from "./FicheDates";
import { FicheVocabulaire } from "./FicheVocabulaire";
import { FicheCarteMentale } from "./FicheCarteMentale";
import { FicheTableauComparatif } from "./FicheTableauComparatif";

// Rend un bloc ```fiche du markdown -- même famille que ```qcm
// (QCMInteractif.tsx), ```chart (GraphiqueDonnees.tsx), ```carte
// (CarteMessage.tsx). Ajouté le 12/09/2026 (demande Bourama, volet
// étudiant ScholarFlow AI, item 4 des specs indépendantes) : remplace le
// résumé générique par une mise en page adaptée au type de fiche
// (formules, dates, vocabulaire, carte mentale, tableau comparatif) au
// lieu d'un résumé générique en texte brut.
//
// Un seul bloc markdown ```fiche, un champ "type" dans le JSON choisit
// l'affichage interne -- option explicitement laissée au choix de
// l'implémenteur dans specs-independantes.md section 4 ("un seul case
// 'fiche' avec un champ type"). Choisi plutôt qu'un case par type : un
// seul point d'entrée dans le switch de BulleMessage.tsx, et le parsing
// JSON + les états chargement/erreur ne sont écrits qu'une fois ici au
// lieu d'être dupliqués dans les 5 sous-composants.
//
// Schémas JSON attendus, un par valeur de "type" (voir le sous-composant
// correspondant pour le détail des champs) :
//   formules            -> FicheFormules.tsx
//   dates               -> FicheDates.tsx
//   vocabulaire         -> FicheVocabulaire.tsx
//   carte-mentale       -> FicheCarteMentale.tsx
//   tableau-comparatif  -> FicheTableauComparatif.tsx
//
// HORS SCOPE ICI (voir specs-independantes.md, section 4) : aucune
// persistance (aucune décision de stockage prise pour les fiches,
// contrairement aux QCM -- voir section 2) et aucune génération par le
// LLM (section 6, pas encore construite) -- ce composant affiche un JSON
// déjà produit, testé ici avec des JSON mockés pour chaque type.
//
// Pas de mécanisme i18n branché sur ce projet à ce jour (même constat
// que QCMInteractif.tsx) : textes fixes en français, comme le reste de
// l'app.

export type FicheFormulesData = {
  type: "formules";
  titre?: string;
  items: { nom: string; expression: string; description?: string }[];
};

export type FicheDatesData = {
  type: "dates";
  titre?: string;
  evenements: { date: string; texte: string; description?: string }[];
};

export type FicheVocabulaireData = {
  type: "vocabulaire";
  titre?: string;
  termes: { terme: string; definition: string; exemple?: string }[];
};

export type BrancheMentale = { texte: string; enfants?: BrancheMentale[] };

export type FicheCarteMentaleData = {
  type: "carte-mentale";
  titre?: string;
  racine: string;
  branches: BrancheMentale[];
};

export type FicheTableauComparatifData = {
  type: "tableau-comparatif";
  titre?: string;
  colonnes: string[];
  lignes: { label: string; valeurs: string[] }[];
};

type Fiche =
  | FicheFormulesData
  | FicheDatesData
  | FicheVocabulaireData
  | FicheCarteMentaleData
  | FicheTableauComparatifData;

function EtatChargement({ texte }: { texte: string }) {
  return (
    <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
      <span className="h-2 w-2 animate-dj-glow rounded-full bg-dj-texte-muet" />
      {texte}
    </div>
  );
}

function EtatErreur({ texte }: { texte: string }) {
  return (
    <div className="my-3 flex h-20 items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 text-xs text-dj-texte-muet">
      <span className="text-[var(--dj-erreur)]">Fiche invalide :</span> {texte}
    </div>
  );
}

export function FicheRevision({ code }: { code: string }) {
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Même principe que QCMInteractif.tsx/CarteMessage.tsx/GraphiqueDonnees.tsx :
  // on attend l'arrêt du streaming (500ms sans changement) avant de
  // tenter le parsing, pour ne pas confondre un JSON encore incomplet
  // avec un JSON réellement cassé.
  useEffect(() => {
    const delai = setTimeout(() => {
      try {
        const valeur = JSON.parse(code);
        setFiche(valeur);
        setErreur(null);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    }, 500);
    return () => clearTimeout(delai);
  }, [code]);

  if (!fiche) {
    return erreur ? (
      <EtatErreur texte="format JSON non reconnu." />
    ) : (
      <EtatChargement texte="Préparation de la fiche..." />
    );
  }

  switch (fiche.type) {
    case "formules":
      if (!Array.isArray(fiche.items) || fiche.items.length === 0) {
        return <EtatErreur texte="au moins une formule est nécessaire." />;
      }
      return <FicheFormules fiche={fiche} />;
    case "dates":
      if (!Array.isArray(fiche.evenements) || fiche.evenements.length === 0) {
        return <EtatErreur texte="au moins un événement est nécessaire." />;
      }
      return <FicheDates fiche={fiche} />;
    case "vocabulaire":
      if (!Array.isArray(fiche.termes) || fiche.termes.length === 0) {
        return <EtatErreur texte="au moins un terme est nécessaire." />;
      }
      return <FicheVocabulaire fiche={fiche} />;
    case "carte-mentale":
      if (typeof fiche.racine !== "string" || !Array.isArray(fiche.branches)) {
        return <EtatErreur texte="une racine et des branches sont nécessaires." />;
      }
      return <FicheCarteMentale fiche={fiche} />;
    case "tableau-comparatif":
      if (!Array.isArray(fiche.colonnes) || !Array.isArray(fiche.lignes)) {
        return <EtatErreur texte="des colonnes et des lignes sont nécessaires." />;
      }
      return <FicheTableauComparatif fiche={fiche} />;
    default:
      return <EtatErreur texte="type de fiche non reconnu." />;
  }
}
