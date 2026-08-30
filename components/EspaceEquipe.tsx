"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { listerMesContenus, listerReceveurs, type ContenuMatiere, type Receveur } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";

/**
 * "Mon équipe" (réécrit le 09/08, demande Bourama : plus de distinction
 * "mes enseignants"/"mes élèves" -- une seule notion, "qui a entré mon
 * code", par matière). Une section dépliable par matière que j'ai
 * écrite (voir EspaceInviter), listant qui l'a débloquée (voir
 * lib/api.ts:listerReceveurs, endpoint créé le 09/08 -- n'existait pas
 * avant, il n'y avait aucun moyen pour l'auteur d'un contenu de voir qui
 * l'utilisait).
 */
export function EspaceEquipe() {
  const [contenus, setContenus] = useState<ContenuMatiere[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [ouvert, setOuvert] = useState<string | null>(null);
  const [receveurs, setReceveurs] = useState<Record<string, Receveur[]>>({});
  const [chargementReceveurs, setChargementReceveurs] = useState<string | null>(null);

  useEffect(() => {
    listerMesContenus()
      .then(setContenus)
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargement(false));
  }, []);

  async function basculer(contenuId: string) {
    if (ouvert === contenuId) {
      setOuvert(null);
      return;
    }
    setOuvert(contenuId);
    if (receveurs[contenuId]) return;
    setChargementReceveurs(contenuId);
    try {
      const r = await listerReceveurs(contenuId);
      setReceveurs((prec) => ({ ...prec, [contenuId]: r }));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargementReceveurs(null);
    }
  }

  return (
    <section className="rounded-2xl border border-dj-bordure bg-dj-surface p-5">
      <h2 className="font-display text-base font-semibold text-dj-texte">Mon équipe</h2>

      {chargement && (
        <div className="mt-4 flex flex-col gap-2" aria-hidden>
          {["w-24", "w-32"].map((largeur, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5"
            >
              <Skeleton className={`h-3.5 ${largeur} rounded`} style={{ animationDelay: `${i * 100}ms` }} />
              <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: `${i * 100 + 40}ms` }} />
            </div>
          ))}
        </div>
      )}

      {erreur && <p className="mt-3 animate-dj-fade-in-rapide text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {!chargement && contenus.length === 0 && !erreur && (
        <p className="mt-3 animate-dj-fade-in-rapide text-sm text-dj-texte-muet">
          Écris une matière pour commencer à avoir une équipe.
        </p>
      )}

      {!chargement && contenus.length > 0 && (
        <div className="mt-4 animate-dj-fade-in-rapide space-y-2">
          {contenus.map((c) => (
            <div key={c.id} className="rounded-xl border border-dj-bordure bg-dj-surface-haute">
              <button
                onClick={() => basculer(c.id)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium text-dj-texte">{c.matiere}</span>
                {ouvert === c.id ? (
                  <ChevronUp size={16} className="text-dj-texte-muet" />
                ) : (
                  <ChevronDown size={16} className="text-dj-texte-muet" />
                )}
              </button>

              {ouvert === c.id && (
                <div className="animate-dj-fade-in-rapide border-t border-dj-bordure px-3 py-2.5">
                  {chargementReceveurs === c.id && (
                    <div className="flex flex-col gap-1.5" aria-hidden>
                      {["w-28", "w-36", "w-20"].map((largeur, i) => (
                        <Skeleton
                          key={i}
                          className={`h-3.5 ${largeur} rounded`}
                          style={{ animationDelay: `${i * 80}ms` }}
                        />
                      ))}
                    </div>
                  )}
                  {chargementReceveurs !== c.id && (receveurs[c.id]?.length ?? 0) === 0 && (
                    <p className="text-xs text-dj-texte-muet">Personne n'a encore entré ce code.</p>
                  )}
                  {chargementReceveurs !== c.id && (receveurs[c.id]?.length ?? 0) > 0 && (
                    <ul className="space-y-1.5">
                      {receveurs[c.id].map((r) => (
                        <li key={r.user_id} className="flex items-center justify-between text-sm">
                          <span className="text-dj-texte">{r.surnom || r.nom_affiche}</span>
                          {!r.actif && <span className="text-xs text-dj-texte-muet">Pas actif chez lui</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
