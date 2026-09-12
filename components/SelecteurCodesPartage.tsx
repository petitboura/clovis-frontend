"use client";

import { useEffect, useState } from "react";
import { listerMesCodes, modifierCode, type CodePartage } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { CaseACocher } from "./CaseACocher";
import { Skeleton } from "./Skeleton";

/**
 * 12/09/2026, chantier "Mes codes = un vrai éditeur" (demande Bourama) :
 * l'attache/détache d'un skill ou d'un dossier à un code de partage doit
 * être possible depuis n'importe quelle section où ce skill/dossier
 * s'ouvre (Mes comportements, Bibliothèque), pas seulement depuis "Mes
 * codes" -- ce composant est ce contrôle, monté dans les deux sens
 * (depuis Mes codes ET depuis l'éditeur du skill/dossier lui-même), les
 * deux passent par le même modifierCode donc toujours synchro.
 *
 * Chaque code affiché correspond à `CodePartage` (voir lib/api.ts) --
 * `comportements`/`dossiers` y sont déjà résolus (id + nom), donc pas de
 * requête supplémentaire par code ici, juste listerMesCodes() une fois.
 */
export function SelecteurCodesPartage({ type, id }: { type: "comportement" | "dossier"; id: string }) {
  const [codes, setCodes] = useState<CodePartage[] | undefined>(undefined);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerMesCodes()
      .then(setCodes)
      .catch(() => setCodes([]));
  }, []);

  function idsLies(c: CodePartage): string[] {
    return (type === "comportement" ? c.comportements : c.dossiers).map((x) => x.id);
  }

  function estAttache(c: CodePartage): boolean {
    return idsLies(c).includes(id);
  }

  async function basculer(c: CodePartage) {
    if (enCours) return;
    setEnCours(c.id);
    setErreur(null);
    const actuels = idsLies(c);
    const nouveaux = estAttache(c) ? actuels.filter((i) => i !== id) : [...actuels, id];
    const patch = type === "comportement" ? { comportement_ids: nouveaux } : { dossier_ids: nouveaux };
    try {
      const maj = await modifierCode(c.id, patch);
      setCodes((prec) => (prec || []).map((x) => (x.id === maj.id ? maj : x)));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(null);
    }
  }

  if (codes === undefined) {
    return (
      <div className="flex flex-col gap-1.5" aria-hidden>
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" style={{ animationDelay: "80ms" }} />
      </div>
    );
  }

  if (codes.length === 0) {
    return <p className="text-xs text-dj-texte-muet">Aucun code de partage créé pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
      <div className="flex flex-col gap-1.5">
        {codes.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-dj-texte">
            <CaseACocher checked={estAttache(c)} onChange={() => basculer(c)} disabled={enCours === c.id} />
            <span className="min-w-0 flex-1 truncate">{c.nom || "Sans nom"}</span>
            <span className="flex-shrink-0 rounded-md bg-dj-fond px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-dj-texte-muet">
              {c.code}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
