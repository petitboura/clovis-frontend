"use client";

import { useEffect, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import {
  lireClassements,
  creerClassement,
  ajouterItemClassement,
  type Classement,
  type TypeClassement,
  type CibleClassement,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { SelectPersonnalise } from "./SelectPersonnalise";

// Petit bouton "+" à afficher à côté de n'importe quel élément existant
// (matière/chapitre -- lot 4, ou document/exercice/examen -- lot 5) pour le
// rattacher à un classement transversal (semestre/année/section). Volontai-
// rement autonome et réutilisable plutôt qu'une vue dédiée (voir brief lot
// 5 : "peut être un simple sélecteur + bouton 'ajouter à un classement'").
// Charge la liste des classements existants seulement à l'ouverture (pas au
// montage) pour ne pas multiplier les appels si beaucoup d'éléments en
// affichent chacun un dans une longue liste.

const TYPES_CLASSEMENT: { id: TypeClassement; label: string }[] = [
  { id: "semestre", label: "Semestre" },
  { id: "annee", label: "Année" },
  { id: "section", label: "Section" },
];

export function AjouterAClassementBouton({
  cibleType,
  cibleId,
  className = "",
}: {
  cibleType: CibleClassement;
  cibleId: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [classements, setClassements] = useState<Classement[] | null>(null);
  const [selection, setSelection] = useState("");
  const [nouveauLabel, setNouveauLabel] = useState("");
  const [nouveauType, setNouveauType] = useState<TypeClassement>("semestre");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirme, setConfirme] = useState(false);

  useEffect(() => {
    if (ouvert && classements === null) {
      lireClassements()
        .then(setClassements)
        .catch(() => setClassements([]));
    }
  }, [ouvert, classements]);

  function fermer() {
    if (enCours) return;
    setOuvert(false);
    setErreur(null);
    setSelection("");
    setNouveauLabel("");
  }

  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      let classementId = selection;
      if (!classementId) {
        const label = nouveauLabel.trim();
        if (!label) return;
        const cree = await creerClassement(nouveauType, label);
        classementId = cree.id;
        setClassements((prec) => [...(prec || []), cree]);
      }
      await ajouterItemClassement(classementId, cibleType, cibleId);
      setConfirme(true);
      setTimeout(fermer, 900);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        title="Ajouter à un classement (semestre, année, section…)"
        className={
          "flex-shrink-0 rounded-cgpt-bouton border border-dj-bordure p-1.5 text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute " +
          className
        }
      >
        <Plus size={12} />
      </button>
    );
  }

  return (
    <div className="flex w-full animate-dj-fade-in-rapide flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-3 text-xs sm:w-64">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-dj-texte">Ajouter à un classement</span>
        <button onClick={fermer} disabled={enCours} className="text-dj-texte-muet hover:text-dj-texte">
          <X size={13} />
        </button>
      </div>

      {confirme ? (
        <p className="flex items-center gap-1.5 text-dj-succes">
          <Check size={13} /> Ajouté.
        </p>
      ) : (
        <>
          {classements === null ? (
            <p className="text-dj-texte-muet">Chargement…</p>
          ) : classements.length > 0 ? (
            <SelectPersonnalise
              valeur={selection}
              onChange={setSelection}
              placeholder="Nouveau classement"
              options={classements.map((c) => ({
                id: c.id,
                label: `${c.label} (${TYPES_CLASSEMENT.find((t) => t.id === c.type)?.label ?? c.type})`,
              }))}
            />
          ) : null}

          {!selection && (
            <div className="flex gap-1.5">
              <SelectPersonnalise
                valeur={nouveauType}
                onChange={(id) => setNouveauType(id as TypeClassement)}
                options={TYPES_CLASSEMENT.map((t) => ({ id: t.id, label: t.label }))}
              />
              <input
                value={nouveauLabel}
                onChange={(e) => setNouveauLabel(e.target.value)}
                placeholder="Ex : Révisions bac"
                className="min-w-0 flex-1 rounded-lg border border-dj-bordure bg-dj-surface-haute px-2 py-1.5 text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>
          )}

          {erreur && <p className="text-[var(--dj-erreur)]">{erreur}</p>}

          <button
            type="button"
            onClick={confirmer}
            disabled={enCours || (!selection && !nouveauLabel.trim())}
            className="self-end rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
          >
            {enCours ? "Ajout…" : "Ajouter"}
          </button>
        </>
      )}
    </div>
  );
}
