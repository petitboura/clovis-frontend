"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Pencil, Copy, Trash2, Check, X } from "lucide-react";
import {
  listerCorrectionsACorrger,
  activerCorrectionPedagogique,
  editerCorrectionPedagogique,
  dupliquerCorrectionPedagogique,
  supprimerCorrectionPedagogique,
  type CorrectionPedagogique,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { CaseACocher } from "./CaseACocher";
import { useOuvrirChatAvecTexte } from "@/lib/contexteChat";

/**
 * "Corrections" (Bureau) -- Point 2, Parties 4/5 du chantier "confiance
 * pédagogique" (06/09/2026). Uniquement les signalements de type A
 * (correctif de fond) : le type B (comportement mal configuré) n'a
 * volontairement aucune vue prof, il est dédié dès l'origine à la
 * cascade de supervision de la Partie 10, pas encore construite (voir
 * api/corrections_pedagogiques.py::a_corriger, filtré type="A" côté
 * serveur -- ce composant ne fait que refléter ce choix, il n'invente
 * rien côté frontend).
 *
 * Pas de tri "par classe" : corrections_pedagogiques n'a aucun lien vers
 * un code (Bureau/Partie 1), et le produit n'expose nulle part ailleurs
 * le nom d'un élève à partir de son id (choix de conception délibéré,
 * confirmé en explorant le dépôt avant d'écrire ce composant) -- afficher
 * un vrai "par élève" demanderait d'exposer une donnée d'identité qui
 * n'existe pas encore ailleurs dans l'app, jamais deviné ici. La liste
 * est donc triée par date, la plus récente en premier.
 */
export function ListeCorrectionsProf() {
  const [ongletActif, setOngletActif] = useState<"nouveau" | "traite">("nouveau");
  const [corrections, setCorrections] = useState<CorrectionPedagogique[] | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [texteEdition, setTexteEdition] = useState("");
  const ouvrirChatAvecTexte = useOuvrirChatAvecTexte();

  function charger(statut: "nouveau" | "traite") {
    setCorrections(undefined);
    listerCorrectionsACorrger(statut)
      .then(setCorrections)
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

  function corriger(c: CorrectionPedagogique) {
    // Contexte structuré + emplacement laissé à compléter par le prof,
    // voir lib/contexteChat.tsx::useOuvrirChatAvecTexte -- déposé dans
    // le champ de saisie d'une conversation neuve, jamais envoyé seul :
    // c'est bien le prof qui déclenche, Clovis n'agit jamais de son
    // propre chef sur une correction pédagogique.
    ouvrirChatAvecTexte(
      `Voici un signalement à corriger (id ${c.id}) :\n` +
        `Question de l'élève : ${c.question_texte}\n` +
        `Ma réponse mise en cause : ${c.reponse_texte}\n\n` +
        `Voici ma correction : `
    );
  }

  async function toggleActif(c: CorrectionPedagogique) {
    setErreur(null);
    try {
      const maj = await activerCorrectionPedagogique(c.id, !c.comportement_actif);
      setCorrections((prec) => (prec || []).map((x) => (x.id === c.id ? maj : x)));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  function commencerEdition(c: CorrectionPedagogique) {
    setEnEdition(c.id);
    setTexteEdition(c.correction_texte ?? "");
  }

  async function sauvegarderEdition(correctionId: string) {
    setErreur(null);
    try {
      const maj = await editerCorrectionPedagogique(correctionId, texteEdition);
      setCorrections((prec) => (prec || []).map((x) => (x.id === correctionId ? maj : x)));
      setEnEdition(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function dupliquer(correctionId: string) {
    setErreur(null);
    try {
      const copie = await dupliquerCorrectionPedagogique(correctionId);
      setCorrections((prec) => [copie, ...(prec || [])]);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function supprimer(correctionId: string) {
    setErreur(null);
    try {
      await supprimerCorrectionPedagogique(correctionId);
      setCorrections((prec) => (prec || []).filter((x) => x.id !== correctionId));
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
          <h2 className="text-base font-medium text-dj-texte">Corrections</h2>
          <BoutonInfoSection
            rubriqueId="corrections-prof"
            texteCourt="Un élève a signalé une réponse de Clovis comme une notion ou une méthode incorrecte. Clique sur « Corriger » pour ouvrir une conversation déjà préparée avec le contexte, où tu n'as plus qu'à taper ou dicter ta correction. Une fois traitée, ton élève reçoit une notification et Clovis en tient compte pour lui."
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1 rounded-cgpt-bouton bg-dj-surface-haute p-1">
        {[
          { id: "nouveau" as const, label: "À corriger" },
          { id: "traite" as const, label: "Traitées" },
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
        {corrections === undefined &&
          [0, 80, 160].map((delai) => (
            <div key={delai} className="rounded-xl border border-dj-bordure bg-dj-surface-haute p-3">
              <Skeleton className="h-3.5 w-3/4 rounded" style={{ animationDelay: `${delai}ms` }} />
              <Skeleton className="mt-2 h-3 w-1/2 rounded" style={{ animationDelay: `${delai + 40}ms` }} />
            </div>
          ))}

        {corrections !== undefined && corrections.length === 0 && (
          <p className="animate-dj-fade-in-rapide py-4 text-center text-sm text-dj-texte-muet">
            {ongletActif === "nouveau" ? "Aucun signalement en attente." : "Aucune correction traitée pour l'instant."}
          </p>
        )}

        {corrections?.map((c, i) => (
          <div
            key={c.id}
            className="animate-dj-fade-in-rapide rounded-xl border border-dj-bordure bg-dj-surface-haute p-3"
            style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
          >
            <p className="text-sm text-dj-texte-muet">
              <span className="font-medium text-dj-texte">Question : </span>
              {c.question_texte || "—"}
            </p>
            <p className="mt-1 text-sm text-dj-texte-muet">
              <span className="font-medium text-dj-texte">Réponse mise en cause : </span>
              {c.reponse_texte || "—"}
            </p>

            {ongletActif === "nouveau" ? (
              <button
                onClick={() => corriger(c)}
                className="mt-2.5 flex items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-sm font-medium text-[#1A0D02] transition-transform hover:scale-[1.02]"
              >
                <MessageSquareText size={14} />
                Corriger
              </button>
            ) : enEdition === c.id ? (
              <div className="mt-2.5 flex flex-col gap-2">
                <textarea
                  value={texteEdition}
                  onChange={(e) => setTexteEdition(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-dj-bordure bg-dj-surface p-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => sauvegarderEdition(c.id)}
                    className="flex items-center gap-1 rounded-cgpt-bouton bg-dj-accent-1 px-2.5 py-1 text-xs font-medium text-[#1A0D02]"
                  >
                    <Check size={12} />
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setEnEdition(null)}
                    className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-2.5 py-1 text-xs font-medium text-dj-texte-muet"
                  >
                    <X size={12} />
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1.5 text-sm text-dj-texte">
                  <span className="font-medium">Correction : </span>
                  {c.correction_texte || "—"}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-dj-texte-muet">
                    <CaseACocher checked={!!c.comportement_actif} onChange={() => toggleActif(c)} />
                    Active
                  </label>
                  <button onClick={() => commencerEdition(c)} aria-label="Éditer la correction" className="rounded-md p-1 text-dj-texte-muet hover:text-dj-texte">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => dupliquer(c.id)} aria-label="Dupliquer la correction" className="rounded-md p-1 text-dj-texte-muet hover:text-dj-texte">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => supprimer(c.id)} aria-label="Supprimer la correction" className="rounded-md p-1 text-dj-texte-muet hover:text-[var(--dj-erreur)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
