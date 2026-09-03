"use client";

import { useState } from "react";
import { X, Flag } from "lucide-react";
import { creerSignalement, type TypeSignalement } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { CaseACocher } from "@/components/CaseACocher";

// Formulaire de signalement (22/08, chantier "rendre la bibliothèque
// plus sérieuse", voir guide Notion "Guide pour droit d'auteur",
// Phase 1). Réutilisé pour une entrée de la bibliothèque publique
// (BibliothequePublique.tsx).
//
// Accessible sans compte (utilisateur_optionnel côté backend) : un
// ayant droit externe n'a aucune raison d'avoir un compte Djiguignè.

type CibleSignalement = { typeSignalement: "bibliotheque_publique"; bibliothequePubliqueId: string; libelle: string };

export function SignalerContenuModal({ cible, onFermer }: { cible: CibleSignalement; onFermer: () => void }) {
  const [motif, setMotif] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [declarationHonneur, setDeclarationHonneur] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  // 01/09/2026 (Bourama : "plein de boutons qui se ferment et s'ouvrent
  // brut") : ouverture animée mais fermeture instantanée -- même
  // mécanisme que lib/useFermetureAnimee.ts.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const fermer = () => demarrerFermeture(onFermer);

  async function envoyer() {
    if (!motif.trim() || !nom.trim() || !email.trim() || !declarationHonneur) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      await creerSignalement({
        type_signalement: cible.typeSignalement as TypeSignalement,
        bibliotheque_publique_id: cible.bibliothequePubliqueId,
        lien_document: cible.libelle,
        motif: motif.trim(),
        plaignant_nom: nom.trim(),
        plaignant_email: email.trim(),
        plaignant_organisation: organisation.trim() || undefined,
        declaration_honneur: declarationHonneur,
      });
      setEnvoye(true);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 ${
        enSortie ? "opacity-0 transition-opacity duration-150 ease-in" : "animate-dj-fade-in-rapide"
      }`}
      onClick={fermer}
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border border-dj-bordure bg-dj-surface p-5 shadow-[0_8px_40px_rgba(0,0,0,0.45)] sm:max-w-md sm:rounded-cgpt-carte ${
          enSortie ? "animate-cgpt-sortie-modal" : "animate-cgpt-entree-modal"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-dj-texte">
            <Flag size={15} /> Signaler ce contenu
          </h4>
          <button onClick={fermer} className="text-dj-texte-muet hover:text-dj-texte">
            <X size={16} />
          </button>
        </div>

        {envoye ? (
          <p className="text-sm text-dj-texte">
            Signalement envoyé. Un administrateur va l&apos;examiner.
          </p>
        ) : (
          <>
            <p className="text-xs text-dj-texte-muet">
              Concerne : <span className="text-dj-texte">{cible.libelle}</span>
            </p>

            <label className="flex flex-col gap-1 text-xs text-dj-texte-muet">
              Motif du signalement
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                placeholder="Explique pourquoi ce contenu enfreint tes droits…"
                className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-dj-texte-muet">
              Ton nom
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-dj-texte-muet">
              Ton email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-dj-texte-muet">
              Organisation (optionnel)
              <input
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                className="rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </label>

            <label className="flex items-start gap-2 text-xs text-dj-texte-muet">
              <CaseACocher checked={declarationHonneur} onChange={setDeclarationHonneur} className="mt-0.5" />
              Je déclare sur l&apos;honneur être titulaire des droits sur ce contenu, ou mandaté pour agir en son
              nom, et que les informations fournies sont exactes.
            </label>

            {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

            <button
              type="button"
              disabled={envoiEnCours || !motif.trim() || !nom.trim() || !email.trim() || !declarationHonneur}
              onClick={envoyer}
              className="mt-1 rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            >
              {envoiEnCours ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
