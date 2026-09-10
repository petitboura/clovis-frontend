"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Copy, Trash2, Tag } from "lucide-react";
import {
  listerSignalementsRecus,
  demanderVisibiliteSignalement,
  rattacherSignalementPedagogique,
  dupliquerSignalementPedagogique,
  supprimerSignalementPedagogique,
  listerMesCodes,
  listerNotions,
  type SignalementPedagogique,
  type CodePartage,
  type Notion,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { useOuvrirChatAvecTexte } from "@/lib/contexteChat";

const CHAMPS: { id: "question" | "reponse" | "conversation"; label: string }[] = [
  { id: "question", label: "la question" },
  { id: "reponse", label: "la réponse" },
  { id: "conversation", label: "le fil de conversation" },
];

/**
 * "Signalements" (Bureau) -- refonte du 10/09/2026, demande Bourama :
 * plus de type A/B, plus de génération automatique de comportement/skill,
 * plus de bouton "actif". Le traitement se fait en discutant librement
 * avec Clovis dans une conversation dédiée (voir core/outils_signalements.py) --
 * ce composant ne fait qu'ouvrir cette conversation avec l'id du
 * signalement en clair dans le message, le modèle le reprend ensuite tel
 * quel comme paramètre de ses outils (voir docstring de consulter_signalement).
 *
 * Pas de tri "par classe/élève" : même contrainte que l'ancien composant,
 * le produit n'expose nulle part le nom d'un élève à partir de son id.
 * Liste triée par date, la plus récente en premier.
 */
export function ListeCorrectionsProf() {
  const [ongletActif, setOngletActif] = useState<"nouveau" | "discute">("nouveau");
  const [signalements, setSignalements] = useState<SignalementPedagogique[] | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);
  const [rattachementOuvertPour, setRattachementOuvertPour] = useState<string | null>(null);
  const [codes, setCodes] = useState<CodePartage[] | undefined>(undefined);
  const [notionsParCode, setNotionsParCode] = useState<Record<string, Notion[]>>({});
  const ouvrirChatAvecTexte = useOuvrirChatAvecTexte();

  function charger(statut: "nouveau" | "discute") {
    setSignalements(undefined);
    listerSignalementsRecus(statut)
      .then(setSignalements)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }

  useEffect(() => {
    charger(ongletActif);
  }, [ongletActif]);

  function discuter(s: SignalementPedagogique) {
    // L'id est repris tel quel par le modèle comme paramètre de
    // consulter_signalement/enregistrer_note_signalement (voir
    // core/outils_signalements.py) -- c'est bien le prof qui déclenche,
    // Clovis n'agit jamais de son propre chef sur un signalement.
    ouvrirChatAvecTexte(
      `Je veux discuter du signalement pédagogique id ${s.id}. ` +
        `Utilise l'outil consulter_signalement avec cet id pour voir de quoi il s'agit, ` +
        `puis discutons-en ensemble.`
    );
  }

  async function demanderCeQuiManque(s: SignalementPedagogique) {
    const manquants = CHAMPS.filter((c) => !(s as any)[`visible_${c.id}`]).map((c) => c.id);
    if (manquants.length === 0) return;
    setErreur(null);
    try {
      const maj = await demanderVisibiliteSignalement(s.id, manquants);
      setSignalements((prec) => (prec || []).map((x) => (x.id === s.id ? maj : x)));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function ouvrirRattachement(s: SignalementPedagogique) {
    setRattachementOuvertPour(s.id);
    if (codes === undefined) {
      try {
        setCodes(await listerMesCodes());
      } catch (e) {
        setErreur(messageErreur(e));
      }
    }
  }

  async function chargerNotions(codeId: string) {
    if (notionsParCode[codeId]) return;
    try {
      const n = await listerNotions(codeId);
      setNotionsParCode((prec) => ({ ...prec, [codeId]: n }));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function rattacher(signalementId: string, codeId: string | null, notionId: string | null) {
    setErreur(null);
    try {
      const maj = await rattacherSignalementPedagogique(signalementId, codeId, notionId);
      setSignalements((prec) => (prec || []).map((x) => (x.id === signalementId ? maj : x)));
      setRattachementOuvertPour(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function dupliquer(signalementId: string) {
    setErreur(null);
    try {
      const copie = await dupliquerSignalementPedagogique(signalementId);
      setSignalements((prec) => [copie, ...(prec || [])]);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function supprimer(signalementId: string) {
    setErreur(null);
    try {
      await supprimerSignalementPedagogique(signalementId);
      setSignalements((prec) => (prec || []).filter((x) => x.id !== signalementId));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour recevoir les signalements de tes élèves." />;
  }

  return (
    <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-medium text-dj-texte">Signalements</h2>
          <BoutonInfoSection
            rubriqueId="signalements-prof"
            texteCourt="Un élève a signalé un problème sur une réponse de Clovis. Clique sur « Discuter » pour ouvrir une conversation avec Clovis et échanger sur ce cas, à ton rythme -- rien n'est automatique, rien n'est traité sans toi."
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1 rounded-cgpt-bouton bg-dj-surface-haute p-1">
        {[
          { id: "nouveau" as const, label: "Nouveaux" },
          { id: "discute" as const, label: "En discussion" },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setOngletActif(o.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              ongletActif === o.id ? "bg-dj-surface text-dj-texte shadow-sm" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {erreur && <p className="mt-3 text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {signalements === undefined &&
          [0, 80, 160].map((delai) => (
            <div key={delai} className="rounded-xl border border-dj-bordure bg-dj-surface-haute p-3">
              <Skeleton className="h-3.5 w-3/4 rounded" style={{ animationDelay: `${delai}ms` }} />
              <Skeleton className="mt-2 h-3 w-1/2 rounded" style={{ animationDelay: `${delai + 40}ms` }} />
            </div>
          ))}

        {signalements !== undefined && signalements.length === 0 && (
          <p className="animate-dj-fade-in-rapide py-4 text-center text-sm text-dj-texte-muet">
            {ongletActif === "nouveau" ? "Aucun signalement en attente." : "Aucune discussion en cours."}
          </p>
        )}

        {signalements?.map((s, i) => {
          const manquants = CHAMPS.filter((c) => !(s as any)[`visible_${c.id}`]);
          const demandeEnCours = manquants.some((c) => (s as any)[`demande_prof_${c.id}`]);
          return (
            <div
              key={s.id}
              className="animate-dj-fade-in-rapide rounded-xl border border-dj-bordure bg-dj-surface-haute p-3"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <p className="text-sm text-dj-texte-muet">
                <span className="font-medium text-dj-texte">Question : </span>
                {s.visible_question ? s.question_texte || "—" : "non partagée par l'élève"}
              </p>
              <p className="mt-1 text-sm text-dj-texte-muet">
                <span className="font-medium text-dj-texte">Réponse mise en cause : </span>
                {s.visible_reponse ? s.reponse_texte || "—" : "non partagée par l'élève"}
              </p>
              {s.probleme_observe && (
                <p className="mt-1 text-sm text-dj-texte-muet">
                  <span className="font-medium text-dj-texte">Problème observé : </span>
                  {s.probleme_observe}
                </p>
              )}
              {s.correction_texte && (
                <p className="mt-1.5 text-sm text-dj-texte">
                  <span className="font-medium">Note actuelle : </span>
                  {s.correction_texte}
                </p>
              )}

              {manquants.length > 0 && (
                <button
                  onClick={() => demanderCeQuiManque(s)}
                  disabled={demandeEnCours}
                  className="mt-2 text-xs font-medium text-dj-accent-1-texte hover:underline disabled:opacity-50"
                >
                  {demandeEnCours
                    ? "Demande envoyée, en attente de l'élève…"
                    : `Demander à voir ${manquants.map((c) => c.label).join(", ")}`}
                </button>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => discuter(s)}
                  className="flex items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-sm font-medium text-[#1A0D02] transition-transform hover:scale-[1.02]"
                >
                  <MessageSquareText size={14} />
                  Discuter
                </button>
                <button onClick={() => ouvrirRattachement(s)} aria-label="Rattacher à une matière ou une notion" className="rounded-md p-1 text-dj-texte-muet hover:text-dj-texte">
                  <Tag size={14} />
                </button>
                <button onClick={() => dupliquer(s.id)} aria-label="Dupliquer le signalement" className="rounded-md p-1 text-dj-texte-muet hover:text-dj-texte">
                  <Copy size={14} />
                </button>
                <button onClick={() => supprimer(s.id)} aria-label="Supprimer le signalement" className="rounded-md p-1 text-dj-texte-muet hover:text-[var(--dj-erreur)]">
                  <Trash2 size={14} />
                </button>
              </div>

              {rattachementOuvertPour === s.id && (
                <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-dj-bordure bg-dj-surface p-2">
                  <select
                    defaultValue={s.code_id ?? ""}
                    onChange={(e) => {
                      const codeId = e.target.value || null;
                      if (codeId) chargerNotions(codeId);
                      rattacher(s.id, codeId, null);
                    }}
                    className="rounded-lg border border-dj-bordure bg-dj-surface-haute p-1.5 text-xs text-dj-texte"
                  >
                    <option value="">Aucune matière</option>
                    {codes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom || c.code}
                      </option>
                    ))}
                  </select>
                  {s.code_id && (
                    <select
                      defaultValue={s.notion_id ?? ""}
                      onChange={(e) => rattacher(s.id, s.code_id, e.target.value || null)}
                      className="rounded-lg border border-dj-bordure bg-dj-surface-haute p-1.5 text-xs text-dj-texte"
                    >
                      <option value="">Aucune notion précise</option>
                      {notionsParCode[s.code_id]?.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.nom}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
