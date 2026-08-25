"use client";

import { useEffect, useState } from "react";
import { X, Download, ExternalLink, Loader2, File as IconFichier, Copy, Check, FolderOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LinkPreview } from "./chat/LinkPreview";

// Types Word/Excel/PowerPoint (anciens .doc/.xls/.ppt + .docx/.xlsx/.pptx)
// -- 25/08, Bourama : "plusieurs types de fichier n'ont pas d'aperçu".
// Pas de conversion propre (CloudConvert, déjà utilisé pour le chat, est
// limité à 10 conversions/jour tous utilisateurs confondus -- inadapté
// à un aperçu rouvert à volonté) : on affiche le fichier via la
// visionneuse Microsoft Office (gratuite, sans limite, lit directement
// une URL publique), dans une iframe qui reste À L'INTÉRIEUR de cette
// fenêtre -- rien ne fait sortir l'utilisateur de l'app.
const TYPES_MIME_OFFICE = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Types texte "supplémentaires" -- 25/08, Bourama : "les autres cas tu ne
// devrais pas les oublier". Plutôt qu'une liste fermée d'extensions
// (CSV, JSON, code...), tout type_mime qui commence par "text/" (le
// navigateur le fait déjà pour la plupart des fichiers texte/code) est
// traité comme du texte lisible -- + une poignée de types "application/"
// qui sont du texte en pratique malgré leur préfixe.
const TYPES_MIME_TEXTE_SUPPLEMENTAIRES = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
]);

function estTypeTexteLisible(typeMime: string) {
  return typeMime.startsWith("text/") || TYPES_MIME_TEXTE_SUPPLEMENTAIRES.has(typeMime);
}

// Détection markdown volontairement basée sur l'EXTENSION du nom de
// fichier en priorité, pas seulement le type_mime : selon le navigateur/
// OS qui a fait l'upload, un ".md" arrive parfois avec type_mime vide ou
// "application/octet-stream" (le type "text/markdown" n'est pas garanti
// comme il l'est pour "image/png" par exemple).
function estFichierMarkdown(nomFichier: string, typeMime: string) {
  return /\.mdx?$/i.test(nomFichier) || typeMime === "text/markdown" || typeMime === "text/x-markdown";
}

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

// 25/08/2026, demande Bourama : "les truc comme du texte ou autre
// doivent avoir un bouton copier" -- réutilisé par ContenuTexte et
// ContenuMarkdown (formaté + brut) ci-dessous.
function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch {
      // Silencieux -- action secondaire, une erreur de presse-papier ne
      // doit rien casser dans la visionneuse.
    }
  }

  return (
    <button
      onClick={copier}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-dj-texte-muet transition-colors hover:text-dj-texte"
    >
      {copie ? <Check size={13} /> : <Copy size={13} />}
      {copie ? "Copié" : "Copier"}
    </button>
  );
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
  return (
    <div className="flex flex-col">
      <div className="flex justify-end border-b border-dj-bordure px-3 py-2">
        <BoutonCopier texte={texte} />
      </div>
      <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm text-dj-texte">{texte}</pre>
    </div>
  );
}

function ContenuMarkdown({ href }: { href: string }) {
  const [texte, setTexte] = useState<string | null>(null);
  const [enErreur, setEnErreur] = useState(false);
  const [vueBrute, setVueBrute] = useState(false);

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
    return <p className="p-6 text-sm text-dj-texte-muet">Impossible de charger ce fichier.</p>;
  }
  if (texte === null) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 size={20} className="animate-spin text-dj-texte-muet" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between gap-1 border-b border-dj-bordure px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setVueBrute(false)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              !vueBrute ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Formaté
          </button>
          <button
            onClick={() => setVueBrute(true)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              vueBrute ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
            }`}
          >
            Brut
          </button>
        </div>
        <BoutonCopier texte={texte} />
      </div>
      {vueBrute ? (
        <pre className="whitespace-pre-wrap break-words p-5 font-sans text-sm text-dj-texte">{texte}</pre>
      ) : (
        <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-dj-texte">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="text-lg font-semibold text-dj-texte">{children}</h1>,
              h2: ({ children }) => <h2 className="mt-2 text-base font-semibold text-dj-texte">{children}</h2>,
              h3: ({ children }) => <h3 className="mt-1 text-sm font-semibold text-dj-texte">{children}</h3>,
              p: ({ children }) => <p>{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              a: ({ href: hrefLien, children }) => (
                <a
                  href={hrefLien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dj-texte-muet hover:text-dj-texte hover:underline"
                >
                  {children}
                </a>
              ),
              code: ({ children }) => (
                <code className="rounded bg-dj-surface-haute px-1 py-0.5 text-xs">{children}</code>
              ),
            }}
          >
            {texte}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ContenuOffice({ href, titre }: { href: string; titre: string }) {
  const [charge, setCharge] = useState(false);
  const urlVisionneuse = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(href)}`;

  return (
    <div className="relative h-[75vh] w-full">
      {!charge && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-dj-texte-muet" />
        </div>
      )}
      <iframe
        src={urlVisionneuse}
        title={titre}
        onLoad={() => setCharge(true)}
        className={`h-full w-full border-0 transition-opacity duration-300 ${charge ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

function ContenuNonPrevisualisable({ href, nom }: { href: string; nom: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <IconFichier size={28} className="text-dj-texte-muet" />
      <p className="text-sm text-dj-texte-muet">Aperçu non disponible pour ce type de fichier.</p>
      <button
        onClick={() => telecharger(href, nom)}
        className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <Download size={13} /> Télécharger
      </button>
    </div>
  );
}

export function VisionneuseBibliotheque({
  fichier,
  onFermer,
  onRanger,
}: {
  fichier: FichierBiblio | null;
  onFermer: () => void;
  // 25/08/2026, demande Bourama : "le bouton [ranger dans un dossier]
  // aussi dans l'aperçu" -- optionnel, fourni seulement par
  // EspaceBibliotheque.tsx (bibliothèque personnelle, seule à avoir des
  // dossiers ; BibliothequePublique.tsx n'en passe pas).
  onRanger?: () => void;
}) {
  if (!fichier) return null;

  const estImage = fichier.type_mime.startsWith("image/");
  const estAudio = fichier.type_mime.startsWith("audio/");
  const estVideo = fichier.type_mime.startsWith("video/");
  const estPdf = fichier.type_mime === "application/pdf";
  const estLien = fichier.type_mime === "text/uri-list";
  const estMarkdown = !estLien && estFichierMarkdown(fichier.nom_fichier, fichier.type_mime);
  const estOffice = TYPES_MIME_OFFICE.has(fichier.type_mime);
  const estTexte = !estLien && !estMarkdown && estTypeTexteLisible(fichier.type_mime);
  const estAutre =
    !estPdf && !estImage && !estAudio && !estVideo && !estTexte && !estMarkdown && !estLien && !estOffice;
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
            {onRanger && (
              <button
                onClick={onRanger}
                aria-label="Ranger dans un dossier"
                title="Ranger dans un dossier"
                className="flex h-8 w-8 items-center justify-center rounded-cgpt-bouton text-dj-texte-muet transition-colors hover:text-dj-texte"
              >
                <FolderOpen size={16} />
              </button>
            )}
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

          {estMarkdown && <ContenuMarkdown href={fichier.url_publique} />}

          {estOffice && <ContenuOffice href={fichier.url_publique} titre={titre} />}

          {estAutre && <ContenuNonPrevisualisable href={fichier.url_publique} nom={fichier.nom_fichier} />}

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
