"use client";

import { useEffect, useState } from "react";
import { ScrollText, X, Link2, Unlink, Check } from "lucide-react";
import {
  lireMesComportements,
  comportementsParLien,
  ajouterComportement,
  attacherComportement,
  type Comportement,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { Skeleton } from "./Skeleton";
import { SelectPersonnalise } from "./SelectPersonnalise";

const AGENT_ID = "clovis";

// Libellé court pour une option de menu -- un comportement sans "nom"
// retombe sur sa description, qui peut être une phrase entière ; jamais
// l'afficher en entier dans un menu (20/08, corrige un débordement
// visible en prod : le texte complet cassait la mise en page).
function libelleCourt(c: Comportement): string {
  const texte = c.nom || c.description || "";
  return texte.length > 50 ? texte.slice(0, 50).trimEnd() + "…" : texte;
}

// Section "Comportements" générique (20/08, demande Bourama : "attacher
// un comportement à un programme, une matière, un chapitre... créés
// depuis le programme OU depuis les comportements, à la création ou
// après"). Même principe que SectionDocumentsBibliotheque : brancher ce
// composant sur n'importe quel écran programme (chapitre, matière,
// programme, examen, section) avec juste typeCible + cibleId.
//
// Un comportement = un seul lien à la fois (remplaçable, pas
// many-to-many comme les documents -- confirmé Bourama 20/08).

type TypeLienComportement = "programme" | "matiere" | "chapitre" | "document" | "exercice" | "examen" | "section";

export function SectionComportementsEmplacement({
  typeCible,
  cibleId,
  titre = "Skills",
}: {
  typeCible: TypeLienComportement;
  cibleId: string;
  titre?: string;
}) {
  const [attaches, setAttaches] = useState<Comportement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  // Deux façons d'ajouter : écrire un nouveau texte, ou attacher un
  // comportement existant (liste chargée à l'ouverture du panneau
  // seulement, pas eagerly).
  const [mode, setMode] = useState<"nouveau" | "existant">("nouveau");
  const [texte, setTexte] = useState("");
  const [existants, setExistants] = useState<Comportement[] | null>(null);
  const [existantChoisi, setExistantChoisi] = useState("");
  const [envoi, setEnvoi] = useState(false);

  function charger() {
    comportementsParLien(AGENT_ID, typeCible, cibleId)
      .then(setAttaches)
      .catch((e) => setErreur(messageErreur(e)));
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCible, cibleId]);

  useEffect(() => ecouterDonneesModifiees("comportements", charger), [typeCible, cibleId]);

  function ouvrirPanneau() {
    setPanneauOuvert(true);
    setMode("nouveau");
    setTexte("");
    setExistantChoisi("");
    setErreur(null);
    if (!existants) {
      lireMesComportements(AGENT_ID)
        .then(setExistants)
        .catch(() => setExistants([]));
    }
  }

  async function detacher(id: string) {
    try {
      await attacherComportement(AGENT_ID, id, null, null);
      setAttaches((prec) => (prec || []).filter((c) => c.id !== id));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function valider() {
    setEnvoi(true);
    setErreur(null);
    try {
      if (mode === "nouveau") {
        if (!texte.trim()) return;
        const cree = await ajouterComportement(AGENT_ID, texte.trim(), null, typeCible, cibleId);
        setAttaches((prec) => [...(prec || []), cree]);
      } else {
        if (!existantChoisi) return;
        const maj = await attacherComportement(AGENT_ID, existantChoisi, typeCible, cibleId);
        setAttaches((prec) => [...(prec || []).filter((c) => c.id !== maj.id), maj]);
      }
      setPanneauOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  // Candidats attachables : comportements existants pas déjà attachés
  // ICI précisément (les attacher les déplacerait depuis leur emplacement
  // actuel, un seul lien à la fois -- comportement voulu, pas un bug).
  const idsDejaIci = new Set((attaches || []).map((c) => c.id));
  const candidats = (existants || []).filter((c) => !idsDejaIci.has(c.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-dj-texte">{titre}</p>
        <button
          onClick={ouvrirPanneau}
          className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
        >
          <ScrollText size={13} /> Attacher un skill
        </button>
      </div>

      {erreur && !panneauOuvert && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}

      {attaches === null && <Skeleton className="h-9 w-full rounded-lg" />}
      {attaches?.length === 0 && <p className="text-xs text-dj-texte-muet">Aucun skill attaché ici.</p>}
      {attaches && attaches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attaches.map((c) => (
            <span
              key={c.id}
              className="flex max-w-[240px] items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface px-3 py-1.5 text-xs text-dj-texte"
            >
              <ScrollText size={12} className="flex-shrink-0 text-dj-texte-muet" />
              <span className="min-w-0 truncate">{libelleCourt(c)}</span>
              <button
                onClick={() => detacher(c.id)}
                title="Détacher"
                className="flex-shrink-0 text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
              >
                <Unlink size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {panneauOuvert && (
        <div className="rounded-xl border border-dj-bordure bg-dj-surface-haute p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-dj-surface p-0.5 text-xs">
              <button
                onClick={() => setMode("nouveau")}
                className={`rounded-md px-2 py-1 transition-colors ${mode === "nouveau" ? "bg-dj-accent-1 text-[#1A0D02]" : "text-dj-texte-muet"}`}
              >
                Nouveau
              </button>
              <button
                onClick={() => setMode("existant")}
                className={`rounded-md px-2 py-1 transition-colors ${mode === "existant" ? "bg-dj-accent-1 text-[#1A0D02]" : "text-dj-texte-muet"}`}
              >
                Existant
              </button>
            </div>
            <button
              onClick={() => setPanneauOuvert(false)}
              className="text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              <X size={14} />
            </button>
          </div>

          {mode === "nouveau" ? (
            <textarea
              autoFocus
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ex : insiste sur la méthode avant le résultat pour ce chapitre"
              rows={3}
              className="w-full resize-none rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
          ) : existants === null ? (
            <Skeleton className="h-9 w-full rounded-lg" />
          ) : candidats.length === 0 ? (
            <p className="text-xs text-dj-texte-muet">Aucun autre skill disponible à attacher ici.</p>
          ) : (
            <SelectPersonnalise
              valeur={existantChoisi}
              onChange={setExistantChoisi}
              placeholder="Choisir un skill…"
              options={candidats.map((c) => ({
                id: c.id,
                label: c.nom || c.description,
                sousLabel: c.lien_libelle ? `dans : ${c.lien_libelle}` : undefined,
              }))}
            />
          )}

          {erreur && <p className="mt-2 text-xs text-[var(--dj-erreur)]">{erreur}</p>}

          <div className="mt-2 flex justify-end">
            <button
              onClick={valider}
              disabled={envoi || (mode === "nouveau" ? !texte.trim() : !existantChoisi)}
              className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              <Check size={12} /> {envoi ? "…" : mode === "nouveau" ? "Créer et attacher" : "Attacher"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { TypeLienComportement };
