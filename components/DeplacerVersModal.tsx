"use client";

import { useState } from "react";
import { X, Move, Globe, Lock, Loader2 } from "lucide-react";
import type { DossierCataloguePublic } from "@/lib/api";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { messageErreur } from "@/lib/erreurs";

// Créé le 09/09/2026, demande Bourama ("confirmation contributeurs") :
// même modale réutilisée pour déplacer un FICHIER ou un SOUS-DOSSIER
// vers un autre dossier -- seul `dossiers` (déjà filtré par l'appelant,
// voir BibliothequePublique.tsx) change entre les deux usages. Chemin
// complet affiché pour chaque dossier (ex. "Mali › Lycée › Terminale")
// pour ne pas confondre deux dossiers de même nom à des endroits
// différents.

function cheminDossier(dossier: DossierCataloguePublic, parId: Map<string, DossierCataloguePublic>): string {
  const segments: string[] = [dossier.nom];
  let courant = dossier.dossier_parent_id;
  while (courant) {
    const parent = parId.get(courant);
    if (!parent) break;
    segments.unshift(parent.nom);
    courant = parent.dossier_parent_id;
  }
  return segments.join(" › ");
}

export function DeplacerVersModal({
  titre,
  dossiers,
  destinationActuelleId,
  onChoisir,
  onFermer,
}: {
  titre: string;
  dossiers: DossierCataloguePublic[];
  // Dossier dans lequel se trouve déjà le fichier/sous-dossier -- exclu
  // de la liste (ça n'aurait aucun sens de le "déplacer" vers lui-même).
  destinationActuelleId: string | null;
  onChoisir: (dossierDestinationId: string) => Promise<void>;
  onFermer: () => void;
}) {
  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(onFermer);

  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const candidats = dossiers.filter((d) => d.id !== destinationActuelleId);

  async function choisir(dossierId: string) {
    setEnCoursId(dossierId);
    setErreur(null);
    try {
      await onChoisir(dossierId);
      fermer();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCoursId(null);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={fermer}
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-dj-bordure bg-dj-surface p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45)] sm:max-w-md sm:rounded-cgpt-carte ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-dj-texte">
            <Move size={15} /> {titre}
          </h4>
          <button onClick={fermer} className="text-dj-texte-muet hover:text-dj-texte">
            <X size={16} />
          </button>
        </div>

        {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

        {candidats.length === 0 ? (
          <p className="text-sm text-dj-texte-muet">Aucun autre dossier disponible pour l&apos;instant.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {candidats.map((d) => (
              <button
                key={d.id}
                onClick={() => choisir(d.id)}
                disabled={enCoursId !== null}
                className="flex items-center gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
              >
                {d.statut === "contribution_libre" ? (
                  <Globe size={14} className="flex-shrink-0 text-dj-texte-muet" />
                ) : (
                  <Lock size={14} className="flex-shrink-0 text-dj-texte-muet" />
                )}
                <span className="min-w-0 flex-1 truncate">{cheminDossier(d, parId)}</span>
                {enCoursId === d.id && <Loader2 size={14} className="flex-shrink-0 animate-spin" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
