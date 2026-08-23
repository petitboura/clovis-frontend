"use client";

import { useEffect, useState } from "react";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";
import { LinkPreview } from "./chat/LinkPreview";

// Fenêtre par-dessus la page (modal) qui remplace le "lien qui ouvre un
// nouvel onglet" de EspaceBibliotheque.tsx (Bourama 17/08 : "rien pour
// ouvrir chaque type dans l'app"). Même style de fenêtre que
// CompteRequisModal.tsx (fond noir semi-transparent, carte
// dj-surface/dj-bordure, animation cgpt-entree-modal), en plus grand
// pour laisser la place au contenu prévisualisé.
//
// Réutilise volontairement les mêmes principes d'affichage que le chat
// (voir components/chat/FichierChip.tsx, LecteurMedia.tsx, LinkPreview.tsx)
// mais en composant dédié plutôt qu'en import direct : ici le fichier
// est TOUJOURS "déjà ouvert" (le clic dans la liste EST l'action
// d'ouverture), pas de repli chip replié/déplié comme dans un fil de
// conversation.
//
// Types couverts : ce sont exactement les types que la bibliothèque
// personnelle accepte aujourd'hui (voir TYPES_AUTORISES dans
// api/bibliotheque_utilisateur.py) + les deux types "virtuels" créés
// côté app, texte (note, type_mime="text/plain") et lien
// (type_mime="text/uri-list", voir core/bibliotheque_fichiers.py).

type FichierBiblio = {
  id: string;
  nom_fichier: string;
  type_mime: string;
  description: string | null;
  url_publique: string;
  created_at: string;
};

// Téléchargement via fetch+blob (même raison que partout ailleurs dans
// le chat : une URL cross-origin Supabase ignore souvent l'attribut
// <a download>, le blob local force le vrai téléchargement).
async function telecharger(href: string, nom: string) {
  try {
    const reponse = await fetch(href);
    const blob = await reponse.blob();
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nom;
    lien.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(href, "_blank");
  }
}

function ContenuTexte({ href }: { href: string }) {
  const [texte, setTexte] = useState<string | null>(null);
  const [enErreur, setEnErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    fetch(href)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => !annule && setTexte(t))
      .catch(() => !annule && setEnErreur(true));
    return () => {
      annule = true;
    };
  }, [href]);

  if (enErreur) {
    return <p className="p-6 text-sm text-dj-texte-muet">Impossible de charger cette note.</p>;
  }
  if (texte === null) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 size={20} className="animate-spin text-dj-texte-muet" />
      </div>
    );
  }
  return <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm text-dj-texte">{texte}</pre>;
}

export function VisionneuseBibliotheque({
  fichier,
  onFermer,
}: {
  fichier: FichierBiblio | null;
  onFermer: () => void;
}) {
  if (!fichier) return null;

  const estImage = fichier.type_mime.startsWith("image/");
  const estAudio = fichier.type_mime.startsWith("audio/");
  const estVideo = fichier.type_mime.startsWith("video/");
  const estPdf = fichier.type_mime === "application/pdf";
  const estTexte = fichier.type_mime === "text/plain";
  const estLien = fichier.type_mime === "text/uri-list";
  const titre = fichier.description || fichier.nom_fichier;

  return (
    <div
      className="fixed inset-0 z-[100] flex animate-dj-fade-in-rapide items-center justify-center bg-black/70 p-4"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl animate-cgpt-entree-modal flex-col overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_2px_24px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-dj-bordure px-4 py-3">
          <span className="min-w-0 truncate text-sm font-medium text-dj-texte">{titre}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {!estLien && (
              <button
                onClick={() => telecharger(fichier.url_publique, fichier.nom_fichier)}
                aria-label="Télécharger"
                className="flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:text-dj-texte"
              >
                <Download size={16} />
              </button>
            )}
            <button
              onClick={onFermer}
              aria-label="Fermer"
              className="flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:text-dj-texte"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {estPdf && <iframe src={fichier.url_publique} className="h-[75vh] w-full" title={titre} />}

          {estImage && (
            // eslint-disable-next-line @next/next/no-img-element -- source dynamique (bucket Supabase), pas un asset local
            <img src={fichier.url_publique} alt={titre} className="mx-auto max-h-[75vh] w-auto object-contain" />
          )}

          {estAudio && (
            <div className="p-6">
              <audio controls src={fichier.url_publique} style={{ colorScheme: "dark" }} className="w-full" />
            </div>
          )}

          {estVideo && (
            <video controls src={fichier.url_publique} style={{ colorScheme: "dark" }} className="max-h-[75vh] w-full" />
          )}

          {estTexte && <ContenuTexte href={fichier.url_publique} />}

          {estLien && (
            <div className="p-5">
              <LinkPreview href={fichier.url_publique} texteLien={titre} />
              <button
                onClick={() => window.open(fichier.url_publique, "_blank", "noopener,noreferrer")}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
              >
                <ExternalLink size={13} /> Ouvrir le site
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
