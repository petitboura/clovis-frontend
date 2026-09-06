"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, Clock, Link2, ChevronRight } from "lucide-react";
import {
  listerEtablissementsPublics,
  listerMesRattachementsEtablissements,
  suivreEtablissement,
  demanderConnexionEtablissement,
  type Etablissement,
  type RattachementEtablissement,
  type EtatRattachementEtablissement,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CompteRequisModal } from "./CompteRequisModal";

/**
 * Créé le 06/09/2026, frontend de la Partie 9 ("fondations système
 * établissement" -- voir core/etablissements.py côté clovis-backend, commit
 * 75cc87f). Section publique (n'importe qui peut parcourir, même sans
 * compte, comme BibliothequePublique.tsx) : liste des établissements
 * actifs, avec pour chacun deux actions bien différenciées --
 *
 * - "Suivre" : immédiate, aucune validation. Contenu public + notifs sur
 *   le contenu public uniquement.
 * - "Se connecter" : part en demande, doit être acceptée par
 *   l'établissement avant de devenir un vrai rattachement (accès au
 *   contenu privé en plus).
 *
 * Parcourir ne demande pas de compte ; seules ces deux actions le
 * demandent -- gate par action (compteRequisPour), pas par page entière,
 * même principe que BibliothequePublique.tsx.
 */
export function EspaceEtablissements() {
  const [liste, setListe] = useState<Etablissement[] | undefined>(undefined);
  const [mesRattachements, setMesRattachements] = useState<RattachementEtablissement[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null); // `${id}:suivre` ou `${id}:connecter`
  const [compteRequisPour, setCompteRequisPour] = useState<{ id: string; action: "suivre" | "connecter" } | null>(
    null
  );

  function charger() {
    listerEtablissementsPublics()
      .then(setListe)
      .catch((e) => setErreur(messageErreur(e)));
  }

  function chargerMesRattachements() {
    // Ne demande rien si pas connecté -- simplement aucun badge affiché,
    // la liste publique reste consultable (401 silencieux, pas une
    // vraie erreur pour un visiteur).
    listerMesRattachementsEtablissements()
      .then(setMesRattachements)
      .catch(() => setMesRattachements([]));
  }

  useEffect(() => {
    charger();
    chargerMesRattachements();
  }, []);

  function etatPour(etablissementId: string): EtatRattachementEtablissement | null {
    return mesRattachements.find((r) => r.etablissement_id === etablissementId)?.etat ?? null;
  }

  async function agir(etablissementId: string, action: "suivre" | "connecter") {
    setErreur(null);
    setEnCours(`${etablissementId}:${action}`);
    try {
      const maj = action === "suivre" ? await suivreEtablissement(etablissementId) : await demanderConnexionEtablissement(etablissementId);
      setMesRattachements((prec) => {
        const sansCelui = prec.filter((r) => r.etablissement_id !== etablissementId);
        return [...sansCelui, maj];
      });
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequisPour({ id: etablissementId, action });
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnCours(null);
    }
  }

  if (liste === undefined) {
    return (
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5"
            >
              <Skeleton className="h-3.5 w-1/3 rounded" style={{ animationDelay: `${i * 80}ms` }} />
              <Skeleton className="h-7 w-40 flex-shrink-0 rounded-cgpt-bouton" style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <div className="flex items-center gap-2">
        <Building2 size={18} className="text-dj-accent-1" />
        <h2 className="font-display text-base font-semibold text-dj-texte">Établissements</h2>
      </div>
      <p className="mt-1 text-xs text-dj-texte-muet">
        Suis un établissement pour son contenu public, ou connecte-toi pour demander l&apos;accès à son contenu privé.
      </p>

      {erreur && <p className="mt-3 text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {liste.length === 0 && (
          <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
            Aucun établissement pour l&apos;instant.
          </p>
        )}

        {liste.map((etab) => {
          const etat = etatPour(etab.id);
          return (
            <div
              key={etab.id}
              className="flex flex-col gap-2.5 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link href={`/etablissements/${etab.id}`} className="group flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-dj-texte group-hover:underline">{etab.nom}</p>
                  {etab.description && <p className="truncate text-xs text-dj-texte-muet">{etab.description}</p>}
                </div>
                <ChevronRight size={14} className="flex-shrink-0 text-dj-texte-muet opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>

              <BoutonsRattachement
                etat={etat}
                enCours={enCours === `${etab.id}:suivre` ? "suivre" : enCours === `${etab.id}:connecter` ? "connecter" : null}
                onSuivre={() => agir(etab.id, "suivre")}
                onConnecter={() => agir(etab.id, "connecter")}
              />
            </div>
          );
        })}
      </div>

      {compteRequisPour && (
        <CompteRequisModal
          texte={compteRequisPour.action === "suivre" ? "Crée un compte pour suivre un établissement." : "Crée un compte pour te connecter à un établissement."}
          onFerme={() => setCompteRequisPour(null)}
        />
      )}
    </section>
  );
}

/** Les deux actions restent visuellement bien différenciées (demande
 * explicite Bourama) : "Suivre" en bouton discret (action légère,
 * immédiate), "Se connecter" en bouton plein accent (action qui engage
 * une vraie demande de rattachement). Une fois un état atteint, le
 * bouton correspondant devient un badge non cliquable plutôt que de
 * disparaître -- l'utilisateur voit toujours où il en est. */
function BoutonsRattachement({
  etat,
  enCours,
  onSuivre,
  onConnecter,
}: {
  etat: EtatRattachementEtablissement | null;
  enCours: "suivre" | "connecter" | null;
  onSuivre: () => void;
  onConnecter: () => void;
}) {
  if (etat === "accepte") {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1/15 px-3 py-1.5 text-xs font-semibold text-dj-accent-1-texte">
        <Check size={14} /> Connecté
      </span>
    );
  }

  if (etat === "demande_en_attente") {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs font-medium text-dj-texte-muet">
        <Clock size={14} /> Demande envoyée
      </span>
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      {etat === "suivi" ? (
        <span className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1.5 text-xs font-medium text-dj-texte-muet">
          <Check size={13} /> Suivi
        </span>
      ) : (
        <button
          onClick={onSuivre}
          disabled={enCours !== null}
          className="rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1.5 text-xs font-medium text-dj-texte transition-colors hover:bg-dj-surface disabled:opacity-50"
        >
          {enCours === "suivre" ? "..." : "Suivre"}
        </button>
      )}
      <button
        onClick={onConnecter}
        disabled={enCours !== null}
        className="flex items-center gap-1 rounded-cgpt-bouton bg-dj-accent-1 px-2.5 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
      >
        <Link2 size={13} /> {enCours === "connecter" ? "..." : "Se connecter"}
      </button>
    </div>
  );
}
