"use client";

import { useEffect, useState } from "react";
import { Globe, Mail, Lock, Building2 } from "lucide-react";
import {
  obtenirEtablissement,
  listerPublicationsEtablissement,
  listerMesRattachementsEtablissements,
  suivreEtablissement,
  demanderConnexionEtablissement,
  type Etablissement,
  type PublicationEtablissement,
  type EtatRattachementEtablissement,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CompteRequisModal } from "./CompteRequisModal";

/** Créé le 06/09/2026, Partie 9 (frontend) : profil d'un établissement +
 * ses publications validées (publiques pour tout le monde, privées en
 * plus si mon rattachement est "accepte" -- le filtrage est déjà fait
 * côté backend selon le token envoyé, ce composant affiche simplement ce
 * qui revient). Réutilise les mêmes deux actions différenciées que
 * EspaceEtablissements.tsx (liste), pour pouvoir suivre/se connecter
 * directement depuis la fiche sans repasser par la liste. */
export function EtablissementDetail({ etablissementId }: { etablissementId: string }) {
  const [etablissement, setEtablissement] = useState<Etablissement | null | undefined>(undefined);
  const [publications, setPublications] = useState<PublicationEtablissement[] | undefined>(undefined);
  const [etat, setEtat] = useState<EtatRattachementEtablissement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<"suivre" | "connecter" | null>(null);
  const [compteRequisPour, setCompteRequisPour] = useState<"suivre" | "connecter" | null>(null);

  useEffect(() => {
    obtenirEtablissement(etablissementId)
      .then(setEtablissement)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 404) {
          setEtablissement(null);
        } else {
          setErreur(messageErreur(e));
        }
      });
    listerPublicationsEtablissement(etablissementId)
      .then(setPublications)
      .catch((e) => setErreur(messageErreur(e)));
    listerMesRattachementsEtablissements()
      .then((liste) => setEtat(liste.find((r) => r.etablissement_id === etablissementId)?.etat ?? null))
      .catch(() => setEtat(null));
  }, [etablissementId]);

  async function agir(action: "suivre" | "connecter") {
    setErreur(null);
    setEnCours(action);
    try {
      const maj = action === "suivre" ? await suivreEtablissement(etablissementId) : await demanderConnexionEtablissement(etablissementId);
      setEtat(maj.etat);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequisPour(action);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnCours(null);
    }
  }

  if (etablissement === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
          <Skeleton className="h-5 w-1/2 rounded" />
          <Skeleton className="mt-2 h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
        </div>
      </div>
    );
  }

  if (etablissement === null) {
    return (
      <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
        Cet établissement est introuvable.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="flex-shrink-0 text-dj-accent-1" />
            <h2 className="font-display text-base font-semibold text-dj-texte">{etablissement.nom}</h2>
          </div>
          <ActionsRattachement etat={etat} enCours={enCours} onSuivre={() => agir("suivre")} onConnecter={() => agir("connecter")} />
        </div>

        {etablissement.description && <p className="mt-2 text-sm text-dj-texte-muet">{etablissement.description}</p>}

        {(etablissement.site_web || etablissement.contact) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-dj-texte-muet">
            {etablissement.site_web && (
              <a href={etablissement.site_web} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-dj-texte">
                <Globe size={13} /> {etablissement.site_web}
              </a>
            )}
            {etablissement.contact && (
              <span className="flex items-center gap-1">
                <Mail size={13} /> {etablissement.contact}
              </span>
            )}
          </div>
        )}
      </section>

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
        <h3 className="font-display text-sm font-semibold text-dj-texte">Publications</h3>

        {publications === undefined && (
          <div className="mt-3 flex flex-col gap-2" aria-hidden>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {publications?.length === 0 && <p className="mt-3 text-xs text-dj-texte-muet">Aucune publication pour l&apos;instant.</p>}

        <div className="mt-3 flex flex-col gap-2">
          {publications?.map((pub) => (
            <div key={pub.id} className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                {pub.titre && <p className="text-sm font-medium text-dj-texte">{pub.titre}</p>}
                {pub.visibilite === "privee" && (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-dj-fond px-1.5 py-0.5 text-[10px] font-semibold text-dj-texte-muet">
                    <Lock size={10} /> Privée
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-dj-texte-muet">{pub.contenu}</p>
            </div>
          ))}
        </div>
      </section>

      {compteRequisPour && (
        <CompteRequisModal
          texte={compteRequisPour === "suivre" ? "Crée un compte pour suivre un établissement." : "Crée un compte pour te connecter à un établissement."}
          onFerme={() => setCompteRequisPour(null)}
        />
      )}
    </div>
  );
}

function ActionsRattachement({
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
    return <span className="flex-shrink-0 rounded-cgpt-bouton bg-dj-accent-1/15 px-2.5 py-1 text-xs font-semibold text-dj-accent-1-texte">Connecté</span>;
  }
  if (etat === "demande_en_attente") {
    return <span className="flex-shrink-0 rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1 text-xs font-medium text-dj-texte-muet">Demande envoyée</span>;
  }
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      {etat !== "suivi" && (
        <button
          onClick={onSuivre}
          disabled={enCours !== null}
          className="rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1 text-xs font-medium text-dj-texte transition-colors hover:bg-dj-surface disabled:opacity-50"
        >
          {enCours === "suivre" ? "..." : "Suivre"}
        </button>
      )}
      <button
        onClick={onConnecter}
        disabled={enCours !== null}
        className="rounded-cgpt-bouton bg-dj-accent-1 px-2.5 py-1 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
      >
        {enCours === "connecter" ? "..." : "Se connecter"}
      </button>
    </div>
  );
}
