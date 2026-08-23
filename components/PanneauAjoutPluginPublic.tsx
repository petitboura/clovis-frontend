"use client";

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import {
  listerMatieresProgramme,
  listerChapitresMatiere,
  type MatiereDuProgramme,
  type ChapitreDeLaMatiere,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { SectionDocumentsBibliotheque } from "./SectionDocumentsBibliotheque";

// Panneau "ajouter un document à un plugin public" (20/08, chantier
// plugin public -- demande Bourama : "tu peux ajouter des documents
// aussi" en plus du téléchargement normal, inchangé). Parcourt la
// structure matière -> chapitre d'un programme qui n'appartient PAS à
// l'utilisateur (lecture relâchée côté backend pour un plugin
// contribution_libre uniquement, voir api/programmes.py). Une fois un
// chapitre choisi, réutilise SectionDocumentsBibliotheque telle quelle
// (classerDocumentEmplacement fonctionne déjà pour un non-propriétaire
// sur ce cas précis, voir core/bibliotheque_programme.py).

export function PanneauAjoutPluginPublic({
  programmeSourceId,
  nomPlugin,
  onFermer,
}: {
  programmeSourceId: string;
  nomPlugin: string;
  onFermer: () => void;
}) {
  const [matieres, setMatieres] = useState<MatiereDuProgramme[] | null>(null);
  const [matiereChoisie, setMatiereChoisie] = useState<MatiereDuProgramme | null>(null);
  const [chapitres, setChapitres] = useState<ChapitreDeLaMatiere[] | null>(null);
  const [chapitreChoisi, setChapitreChoisi] = useState<ChapitreDeLaMatiere | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    listerMatieresProgramme(programmeSourceId)
      .then((res) => !annule && setMatieres(res))
      .catch((e) => !annule && setErreur(messageErreur(e)));
    return () => {
      annule = true;
    };
  }, [programmeSourceId]);

  useEffect(() => {
    if (!matiereChoisie) {
      setChapitres(null);
      return;
    }
    let annule = false;
    setChapitres(null);
    listerChapitresMatiere(matiereChoisie.id)
      .then((res) => !annule && setChapitres(res))
      .catch((e) => !annule && setErreur(messageErreur(e)));
    return () => {
      annule = true;
    };
  }, [matiereChoisie]);

  return (
    <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-dj-texte">Ajouter un document · {nomPlugin}</p>
        <button
          type="button"
          onClick={onFermer}
          className="flex-shrink-0 rounded-full p-1 text-dj-texte-muet transition-colors hover:bg-dj-surface-hover hover:text-dj-texte"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      {erreur && <p className="mb-2 text-xs text-[var(--dj-erreur)]">{erreur}</p>}

      {/* Fil d'Ariane matière -> chapitre */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-dj-texte-muet">
        <button
          type="button"
          onClick={() => {
            setMatiereChoisie(null);
            setChapitreChoisi(null);
          }}
          className={matiereChoisie ? "hover:text-dj-texte hover:underline" : "font-medium text-dj-texte"}
        >
          Matières
        </button>
        {matiereChoisie && (
          <>
            <ChevronRight size={12} />
            <button
              type="button"
              onClick={() => setChapitreChoisi(null)}
              className={chapitreChoisi ? "hover:text-dj-texte hover:underline" : "font-medium text-dj-texte"}
            >
              {matiereChoisie.nom}
            </button>
          </>
        )}
        {chapitreChoisi && (
          <>
            <ChevronRight size={12} />
            <span className="font-medium text-dj-texte">{chapitreChoisi.nom}</span>
          </>
        )}
      </div>

      {!matiereChoisie && (
        <div className="space-y-1">
          {matieres === null && <Skeleton className="h-9 w-full" />}
          {matieres?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucune matière dans ce programme.</p>}
          {matieres?.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMatiereChoisie(m)}
              className="flex w-full items-center justify-between rounded-lg border border-dj-bordure px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-hover"
            >
              {m.nom}
              <ChevronRight size={14} className="text-dj-texte-muet" />
            </button>
          ))}
        </div>
      )}

      {matiereChoisie && !chapitreChoisi && (
        <div className="space-y-1">
          {chapitres === null && <Skeleton className="h-9 w-full" />}
          {chapitres?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun chapitre dans cette matière.</p>}
          {chapitres?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChapitreChoisi(c)}
              className="flex w-full items-center justify-between rounded-lg border border-dj-bordure px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-hover"
            >
              {c.nom}
              <ChevronRight size={14} className="text-dj-texte-muet" />
            </button>
          ))}
        </div>
      )}

      {chapitreChoisi && (
        <SectionDocumentsBibliotheque typeCible="chapitre" cibleId={chapitreChoisi.id} titre="Documents de ce chapitre" />
      )}
    </div>
  );
}
