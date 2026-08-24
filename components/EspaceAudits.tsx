"use client";

import { useEffect, useState } from "react";
import { BookOpen, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import {
  listerProgrammes,
  listerAuditsProgramme,
  listerAuditsChapitres,
  lireAuditProgrammeGlobal,
  executerAuditsProgramme,
  type Programme,
  type AuditMatiere,
  type AuditChapitre,
  type AuditProgrammeGlobal,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";

// Onglet "Audits" (2026-08-12, chantier "connexion IA <-> structure
// programme" ; étendu le 26/08/2026, récap complet Bourama). Nouvelle
// section DÉDIÉE, volontairement séparée de "Mes comportements/skills"
// (décision Bourama 12/08) -- affiche, pour chaque programme, une
// cascade à trois niveaux (chapitre -> matière -> programme) : le texte
// que l'IA a écrit en analysant tout le contenu réel de chaque niveau
// (documents, exercices, examens).
//
// Lecture seule : l'audit est réécrit en place chaque lundi par l'IA
// (voir core/audit_programme.py côté backend) -- rien à éditer ici,
// n'importe quelle modification serait de toute façon écrasée au lundi
// suivant. Seule action possible : déclencher la cascade manuellement
// pour tester sans attendre le lundi suivant.

export function EspaceAudits() {
  const [programmes, setProgrammes] = useState<Programme[] | null>(null);
  const [programmeOuvert, setProgrammeOuvert] = useState<Programme | null>(null);
  // Refonte "Mon espace = l'app" : section auparavant inatteignable sans
  // compte, même détection 401 que les autres.
  const [sansCompte, setSansCompte] = useState(false);

  useEffect(() => {
    listerProgrammes()
      .then(setProgrammes)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        }
        setProgrammes([]);
      });
  }, []);

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour voir les audits de ton programme." />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Chaque lundi, Clovis relit tout le contenu réel de ton programme, chapitre par chapitre, matière
        par matière, puis pour le programme entier, et écrit ici un état des lieux du périmètre réel.
        Texte réécrit automatiquement chaque semaine, tu ne peux pas le modifier directement.
      </p>

      {programmeOuvert ? (
        <AuditsDuProgramme programme={programmeOuvert} onRetour={() => setProgrammeOuvert(null)} />
      ) : (
        <ListeProgrammesAudits programmes={programmes} onOuvrir={setProgrammeOuvert} />
      )}
    </div>
  );
}

function ListeProgrammesAudits({
  programmes,
  onOuvrir,
}: {
  programmes: Programme[] | null;
  onOuvrir: (p: Programme) => void;
}) {
  if (programmes === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (programmes.length === 0) {
    return (
      <p className="rounded-xl border border-dj-bordure p-4 text-sm text-dj-texte-muet">
        Aucun programme pour l&apos;instant, crée-en un dans l&apos;onglet &laquo;&nbsp;Mon programme&nbsp;&raquo;
        pour que Clovis puisse commencer à l&apos;auditer.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {programmes.map((p) => (
        <button
          key={p.id}
          onClick={() => onOuvrir(p)}
          className="flex items-center gap-3 rounded-xl border border-dj-bordure p-4 text-left transition-colors hover:border-dj-bordure-forte"
        >
          <BookOpen size={18} className="flex-shrink-0 text-dj-texte-muet" />
          <div>
            <div className="font-semibold text-dj-texte">{p.niveau}</div>
            {p.nom && <div className="text-sm text-dj-texte-muet">{p.nom}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}

function AuditsDuProgramme({ programme, onRetour }: { programme: Programme; onRetour: () => void }) {
  const [auditGlobal, setAuditGlobal] = useState<AuditProgrammeGlobal | null>(null);
  const [audits, setAudits] = useState<AuditMatiere[] | null>(null);
  const [auditsChapitres, setAuditsChapitres] = useState<AuditChapitre[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [matiereOuverte, setMatiereOuverte] = useState<string | null>(null);
  const [chapitreOuvert, setChapitreOuvert] = useState<string | null>(null);
  const [auditGlobalOuvert, setAuditGlobalOuvert] = useState(false);
  const [lancementEnCours, setLancementEnCours] = useState(false);

  useEffect(() => {
    charger();
  }, [programme.id]);

  function charger() {
    setErreur(null);
    Promise.all([lireAuditProgrammeGlobal(programme.id), listerAuditsProgramme(programme.id), listerAuditsChapitres(programme.id)])
      .then(([global, matieres, chapitres]) => {
        setAuditGlobal(global);
        setAudits(matieres);
        setAuditsChapitres(chapitres);
      })
      .catch((e) => setErreur(messageErreur(e)));
  }

  function lancerMaintenant() {
    setLancementEnCours(true);
    setErreur(null);
    executerAuditsProgramme(programme.id)
      .then(() => charger())
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setLancementEnCours(false));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onRetour} className="text-sm text-dj-texte-muet transition-colors hover:text-dj-texte">
          ← {programme.niveau}
        </button>
        <button
          onClick={lancerMaintenant}
          disabled={lancementEnCours}
          className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
        >
          {lancementEnCours ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {lancementEnCours ? "Audit en cours..." : "Lancer les audits maintenant"}
        </button>
      </div>

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {auditGlobal === null || audits === null || auditsChapitres === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Niveau programme -- le plus large, toujours en premier */}
          <div className="rounded-xl border border-dj-bordure-forte bg-dj-surface p-4">
            <button onClick={() => setAuditGlobalOuvert(!auditGlobalOuvert)} className="flex w-full items-center justify-between text-left">
              <span className="font-semibold text-dj-texte">Programme entier</span>
              {auditGlobal.derniere_execution ? (
                <span className="flex items-center gap-1 text-xs text-dj-texte-muet">
                  <RefreshCw size={12} />
                  {new Date(auditGlobal.derniere_execution).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              ) : (
                <span className="text-xs text-dj-texte-muet">Pas encore audité</span>
              )}
            </button>
            {auditGlobalOuvert && (
              <div className="mt-3 whitespace-pre-wrap text-sm text-dj-texte-muet">
                {auditGlobal.texte ?? "Ce programme n'a pas encore de matière à analyser."}
              </div>
            )}
          </div>

          {audits.length === 0 ? (
            <p className="rounded-xl border border-dj-bordure p-4 text-sm text-dj-texte-muet">
              Aucune matière dans ce programme pour l&apos;instant.
            </p>
          ) : (
            audits.map((audit) => {
              const chapitresDeLaMatiere = auditsChapitres.filter((c) => c.matiere_id === audit.matiere_id);
              return (
                <div key={audit.matiere_id} className="rounded-xl border border-dj-bordure p-4">
                  <button
                    onClick={() => setMatiereOuverte(matiereOuverte === audit.matiere_id ? null : audit.matiere_id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="font-semibold text-dj-texte">{audit.matiere_nom}</span>
                    {audit.derniere_execution ? (
                      <span className="flex items-center gap-1 text-xs text-dj-texte-muet">
                        <RefreshCw size={12} />
                        {new Date(audit.derniere_execution).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    ) : (
                      <span className="text-xs text-dj-texte-muet">Pas encore audité</span>
                    )}
                  </button>

                  {matiereOuverte === audit.matiere_id && (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="whitespace-pre-wrap text-sm text-dj-texte-muet">
                        {audit.texte ?? "Cette matière n'a pas encore de contenu à analyser (ajoute des chapitres, documents ou exercices dans « Mon programme »)."}
                      </div>

                      {chapitresDeLaMatiere.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-dj-bordure pt-3">
                          <span className="text-xs font-medium text-dj-texte-muet">Chapitre par chapitre</span>
                          {chapitresDeLaMatiere.map((chapitre) => (
                            <div key={chapitre.chapitre_id} className="rounded-lg border border-dj-bordure p-3">
                              <button
                                onClick={() => setChapitreOuvert(chapitreOuvert === chapitre.chapitre_id ? null : chapitre.chapitre_id)}
                                className="flex w-full items-center justify-between text-left text-sm"
                              >
                                <span className="text-dj-texte">{chapitre.chapitre_nom}</span>
                                {!chapitre.derniere_execution && <span className="text-xs text-dj-texte-muet">Pas encore audité</span>}
                              </button>
                              {chapitreOuvert === chapitre.chapitre_id && (
                                <div className="mt-2 whitespace-pre-wrap text-sm text-dj-texte-muet">
                                  {chapitre.texte ?? "Ce chapitre n'a pas encore de contenu à analyser."}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
