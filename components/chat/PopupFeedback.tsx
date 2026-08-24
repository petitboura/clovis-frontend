"use client";

import { useEffect, useState } from "react";
import { appelerApi } from "@/lib/api";
import { SelectPersonnalise } from "../SelectPersonnalise";

interface Categorie {
  id: string;
  libelle: string;
}

// Règle de confidentialité
// stricte : par défaut (rien coché/rempli), le créateur ne reçoit QUE le
// type positif/négatif -- jamais le contenu de la conversation, sauf choix
// explicite via les deux cases à cocher ci-dessous.
export function PopupFeedback({
  type,
  conversationId,
  messageId,
  questionMessageId,
  agentId,
  onFerme,
  onEnvoye,
}: {
  type: "positif" | "negatif";
  conversationId: string;
  messageId: number;
  questionMessageId: number | null;
  agentId: string;
  onFerme: () => void;
  onEnvoye: () => void;
}) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [categorie, setCategorie] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [reponsePartagee, setReponsePartagee] = useState(false);
  const [questionPartagee, setQuestionPartagee] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    if (type === "negatif") {
      appelerApi("/api/feedback/categories")
        .then((r) => setCategories(r.categories))
        .catch(() => setCategories([]));
    }
  }, [type]);

  async function envoyer() {
    setEnvoiEnCours(true);
    try {
      await appelerApi("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: messageId,
          question_message_id: questionMessageId,
          agent_id: agentId,
          type,
          categorie: categorie || null,
          commentaire: commentaire || null,
          reponse_partagee: reponsePartagee,
          question_partagee: questionPartagee,
        }),
      });
      onEnvoye();
    } catch (e) {
      alert("Impossible d'envoyer ce retour pour le moment.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 animate-dj-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-dj-bordure bg-dj-surface p-6">
        <h2 className="text-lg font-bold text-dj-texte">
          Donner un retour {type === "positif" ? "positif" : "négatif"}
        </h2>

        {type === "negatif" && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm text-dj-texte-muet">
              Quel type de problème souhaitez-vous signaler ? (facultatif)
            </label>
            <SelectPersonnalise
              valeur={categorie}
              onChange={setCategorie}
              placeholder="Sélectionner…"
              options={categories.map((c) => ({ id: c.id, label: c.libelle }))}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-sm text-dj-texte-muet">
            Veuillez fournir des détails : (facultatif)
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder={
              type === "positif"
                ? "Dans quelle mesure cette réponse était-elle satisfaisante ?"
                : "Dans quelle mesure cette réponse était-elle insatisfaisante ?"
            }
            rows={3}
            className="w-full resize-none rounded-lg border border-dj-bordure bg-dj-fond px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
        </div>

        {/* Cases à cocher -- confidentialité stricte : sans elles, le
            créateur ne voit ni la réponse de son IA ni la question posée. */}
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-dj-texte-muet">
            <input
              type="checkbox"
              checked={reponsePartagee}
              onChange={(e) => setReponsePartagee(e.target.checked)}
              className="h-4 w-4 accent-dj-accent-1"
            />
            Envoyer la réponse de Clovis
          </label>
          <label className="flex items-center gap-2 text-sm text-dj-texte-muet">
            <input
              type="checkbox"
              checked={questionPartagee}
              onChange={(e) => setQuestionPartagee(e.target.checked)}
              className="h-4 w-4 accent-dj-accent-1"
            />
            Envoyer ma question
          </label>
        </div>

        <p className="mt-3 text-xs text-dj-inactif">
          Par défaut, le créateur reçoit uniquement le type de retour (positif/négatif), sans
          aucun contenu de votre conversation.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onFerme}
            className="rounded-cgpt-bouton border border-dj-bordure px-4 py-2 text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte"
          >
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={envoiEnCours}
            className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-sm font-bold text-[#1A0D02] disabled:opacity-60"
          >
            {envoiEnCours ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
