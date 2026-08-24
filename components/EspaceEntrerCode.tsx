"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  entrerCodePartage,
  listerMesRattachementsCodes,
  retirerRattachementCode,
  type RattachementCode,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";

/**
 * Bloc "Entrer un code" (réécrit le 14/08/2026, demande Bourama --
 * remplace le système "un code = une matière débloquée", jamais lu par
 * le chat, voir core/codes_partage.py). Entrer un code donne accès à
 * TOUT ce que ce code porte (comportement/programme/bibliothèque/texte)
 * -- rien à choisir, avoir le code suffit. Le comportement/programme
 * reçus apparaissent dans leurs sections respectives (voir
 * ComportementsRecus.tsx / ProgrammesRecus.tsx), la bibliothèque se
 * copie automatiquement (voir core/codes_partage.py::propager_*) -- ce
 * bloc-ci reste la vue d'ensemble de mes rattachements + le texte libre,
 * qui lui n'a pas d'autre section où vivre.
 */
export function EspaceEntrerCode() {
  const [rattachements, setRattachements] = useState<RattachementCode[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [messageOk, setMessageOk] = useState<string | null>(null);
  // Refonte "Mon espace = l'app" : section auparavant inatteignable sans
  // compte, même détection 401 que les autres.
  const [sansCompte, setSansCompte] = useState(false);

  function charger() {
    setChargement(true);
    listerMesRattachementsCodes()
      .then(setRattachements)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreur(messageErreur(e));
        }
      })
      .finally(() => setChargement(false));
  }

  useEffect(charger, []);

  async function valider() {
    if (!code.trim()) return;
    setErreur(null);
    setMessageOk(null);
    setEnCours(true);
    try {
      await entrerCodePartage(code.trim());
      setMessageOk("Code accepté.");
      setCode("");
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function retirer(rattachementId: string) {
    setErreur(null);
    try {
      await retirerRattachementCode(rattachementId);
      setRattachements((prec) => prec.filter((r) => r.rattachement_id !== rattachementId));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const avecTexteLibre = rattachements.filter((r) => r.texte_libre);

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour entrer un code reçu." />;
  }

  return (
    <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <h2 className="font-display text-base font-semibold text-dj-texte">Entrer un code</h2>
      <p className="mt-1 text-xs text-dj-texte-muet">
        Quelqu&apos;un t&apos;a donné un code ? Entre-le ici pour recevoir tout ce qu&apos;il partage.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && valider()}
          placeholder="Ex : AB3CD9"
          maxLength={6}
          className="flex-1 rounded-xl border border-dj-bordure bg-dj-surface-haute px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.2em] text-dj-texte placeholder:text-dj-texte-muet"
        />
        <button
          onClick={valider}
          disabled={enCours || !code.trim()}
          className="rounded-cgpt-bouton bg-dj-accent-1 px-5 py-3 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
        >
          {enCours ? "…" : "Valider"}
        </button>
      </div>

      {messageOk && <p className="mt-3 animate-dj-fade-in-rapide text-sm text-dj-succes">{messageOk}</p>}
      {erreur && <p className="mt-3 animate-dj-fade-in-rapide text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {chargement && <Skeleton className="mt-4 h-14 rounded-xl border border-dj-bordure" />}

      {!chargement && rattachements.length > 0 && (
        <div className="mt-4 animate-dj-fade-in-rapide space-y-2 border-t border-dj-bordure pt-3">
          <p className="text-xs font-semibold text-dj-texte-muet">Codes reçus</p>
          {rattachements.map((r) => (
            <div
              key={r.rattachement_id}
              className="flex items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="text-dj-texte">{r.nom_code || r.code}</span>
                <span className="text-dj-texte-muet"> · reçu de {r.proprietaire_nom}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.a_comportement && <Badge>Skill</Badge>}
                  {r.a_programme && <Badge>Programme</Badge>}
                  {r.partage_bibliotheque && <Badge>Bibliothèque</Badge>}
                  {r.texte_libre && <Badge>Texte</Badge>}
                </div>
              </div>
              <button
                onClick={() => retirer(r.rattachement_id)}
                title="Retirer ce code"
                className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!chargement && avecTexteLibre.length > 0 && (
        <div className="mt-4 animate-dj-fade-in-rapide space-y-2 border-t border-dj-bordure pt-3">
          <p className="text-xs font-semibold text-dj-texte-muet">Reçu</p>
          {avecTexteLibre.map((r) => (
            <div key={r.rattachement_id} className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2">
              <p className="text-xs text-dj-texte-muet">Reçu de {r.proprietaire_nom}</p>
              <p className="mt-0.5 text-sm text-dj-texte">{r.texte_libre}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-dj-fond px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dj-texte-muet">
      {children}
    </span>
  );
}
