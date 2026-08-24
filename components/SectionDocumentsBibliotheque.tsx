"use client";

import { useEffect, useState } from "react";
import {
  Paperclip,
  Link as IconLien,
  FileText,
  Image as IconImage,
  AudioLines as IconAudio,
  Video as IconVideo,
  X,
  Library,
  Flag,
} from "lucide-react";
import {
  listerDocumentsEmplacement,
  classerDocumentEmplacement,
  declasserDocumentEmplacement,
  listerBibliothequePersonnelle,
  ajouterFichierBibliothequePersonnelle,
  type TypeEmplacementProgramme,
  type FichierEmplacementProgramme,
  type FichierBibliothequePersonnelle,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { Skeleton } from "./Skeleton";
import { VisionneuseBibliotheque } from "./VisionneuseBibliotheque";
import { SignalerContenuModal } from "./SignalerContenuModal";

// Section "Documents" générique (17/08, chantier "bibliothèque partout
// dans le programme" -- demande Bourama : "bibliothèque et classement
// est un plus", branchée à n'importe quel emplacement du programme
// (programme/matière/chapitre/exercice/examen) via le même mécanisme.
// Voir api/emplacements_bibliotheque_programme.py côté backend.
//
// Distincte de SectionDocuments (ancien texte/lien, propre au chapitre,
// dans EspaceProgrammeContenu.tsx) : les deux cohabitent, celle-ci
// n'ajoute QUE des vrais fichiers de la bibliothèque personnelle.

function iconePourType(typeMime: string) {
  if (typeMime === "text/uri-list") return IconLien;
  if (typeMime === "text/plain") return FileText;
  if (typeMime.startsWith("image/")) return IconImage;
  if (typeMime.startsWith("audio/")) return IconAudio;
  if (typeMime.startsWith("video/")) return IconVideo;
  return Paperclip;
}

export function SectionDocumentsBibliotheque({
  typeCible,
  cibleId,
  titre = "Documents",
}: {
  typeCible: TypeEmplacementProgramme;
  cibleId: string;
  titre?: string;
}) {
  const [documents, setDocuments] = useState<FichierEmplacementProgramme[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [pickerOuvert, setPickerOuvert] = useState(false);
  const [bibliotheque, setBibliotheque] = useState<FichierBibliothequePersonnelle[] | null>(null);
  const [erreurPicker, setErreurPicker] = useState<string | null>(null);

  const [fichierOuvert, setFichierOuvert] = useState<FichierEmplacementProgramme | null>(null);
  const [fichierSignale, setFichierSignale] = useState<FichierEmplacementProgramme | null>(null);

  useEffect(() => {
    setDocuments(null);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCible, cibleId]);

  // Même mécanisme que le reste du programme (voir SectionDocuments /
  // SectionExercices ci-dessus dans EspaceProgrammeContenu.tsx) : se
  // rafraîchit si une autre partie de l'app (ou l'IA en conversation)
  // classe/déclasse un document ici.
  useEffect(() => ecouterDonneesModifiees("programme", charger), [typeCible, cibleId]);

  function charger() {
    listerDocumentsEmplacement(typeCible, cibleId)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }

  async function envoyerFichiers(fichiers: File[]) {
    if (fichiers.length === 0) return;
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      for (const fichier of fichiers) {
        const ligne = await ajouterFichierBibliothequePersonnelle(fichier, "", "");
        await classerDocumentEmplacement(typeCible, cibleId, ligne.id);
      }
      charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function ouvrirPicker() {
    setPickerOuvert(true);
    setErreurPicker(null);
    if (bibliotheque === null) {
      try {
        setBibliotheque(await listerBibliothequePersonnelle());
      } catch (e) {
        setErreurPicker(messageErreur(e));
        setBibliotheque([]);
      }
    }
  }

  async function choisirDepuisBibliotheque(fichierId: string) {
    setErreurPicker(null);
    try {
      await classerDocumentEmplacement(typeCible, cibleId, fichierId);
      charger();
    } catch (e) {
      setErreurPicker(messageErreur(e));
    }
  }

  async function retirer(fichierId: string, nom: string) {
    if (!window.confirm(`Retirer « ${nom} » d'ici ? (le fichier reste dans ta bibliothèque)`)) return;
    try {
      await declasserDocumentEmplacement(typeCible, cibleId, fichierId);
      charger();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  const idsDejaClasses = new Set((documents ?? []).map((d) => d.id));
  const bibliothequeRestante = (bibliotheque ?? []).filter((f) => !idsDejaClasses.has(f.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-dj-texte">{titre}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={ouvrirPicker}
            className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
          >
            <Library size={13} /> Depuis ma bibliothèque
          </button>
          <label className="flex cursor-pointer items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte">
            <Paperclip size={13} /> {envoiEnCours ? "Envoi…" : "Envoyer un fichier"}
            <input
              type="file"
              multiple
              disabled={envoiEnCours}
              accept="*/*"
              onChange={(e) => {
                const fichiers = Array.from(e.target.files ?? []);
                e.target.value = "";
                envoyerFichiers(fichiers);
              }}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {documents === null && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-12 rounded-xl border border-dj-bordure" />
        </div>
      )}
      {documents?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun document pour l&apos;instant.</p>}
      {documents && documents.length > 0 && (
        <div className="flex flex-col gap-2">
          {documents.map((d) => {
            const Icone = iconePourType(d.type_mime);
            return (
              <div
                key={d.id}
                onClick={() => setFichierOuvert(d)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
              >
                <span className="flex min-w-0 items-center gap-2 text-left text-sm text-dj-texte">
                  <Icone size={14} className="flex-shrink-0" />
                  <span className="truncate">{d.description || d.nom_fichier}</span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-3">
                  {d.emplacement_public && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFichierSignale(d);
                      }}
                      title="Signaler ce contenu"
                      className="text-xs text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                    >
                      <Flag size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      retirer(d.id, d.description || d.nom_fichier);
                    }}
                    className="text-xs text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    Retirer
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {pickerOuvert && (
        <div
          className="fixed inset-0 z-50 flex animate-dj-fade-in-rapide items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setPickerOuvert(false)}
        >
          <div
            className="flex max-h-[70vh] w-full flex-col gap-3 rounded-t-2xl border border-dj-bordure bg-dj-surface p-4 shadow-[0_8px_40px_rgba(0,0,0,0.45)] animate-cgpt-entree-modal sm:max-w-md sm:rounded-cgpt-carte"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-dj-texte">Choisir dans ma bibliothèque</h4>
              <button onClick={() => setPickerOuvert(false)} className="text-dj-texte-muet hover:text-dj-texte">
                <X size={16} />
              </button>
            </div>

            {erreurPicker && <p className="text-sm text-[var(--dj-erreur)]">{erreurPicker}</p>}

            {bibliotheque === null && (
              <div className="flex flex-col gap-2" aria-hidden>
                <Skeleton className="h-10 rounded-xl border border-dj-bordure" />
                <Skeleton className="h-10 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
              </div>
            )}
            {bibliotheque && bibliothequeRestante.length === 0 && (
              <p className="text-sm text-dj-texte-muet">
                {bibliotheque.length === 0
                  ? "Ta bibliothèque est vide pour l'instant."
                  : "Tout ce qu'il y a dans ta bibliothèque est déjà ici."}
              </p>
            )}
            {bibliotheque && bibliothequeRestante.length > 0 && (
              <div className="flex flex-col gap-2 overflow-y-auto">
                {bibliothequeRestante.map((f) => {
                  const Icone = iconePourType(f.type_mime);
                  return (
                    <button
                      key={f.id}
                      onClick={() => choisirDepuisBibliotheque(f.id)}
                      className="flex items-center gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte"
                    >
                      <Icone size={14} className="flex-shrink-0 text-dj-texte-muet" />
                      <span className="truncate">{f.description || f.nom_fichier}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <VisionneuseBibliotheque fichier={fichierOuvert} onFermer={() => setFichierOuvert(null)} />

      {fichierSignale && (
        <SignalerContenuModal
          cible={{
            typeSignalement: "document_programme",
            fichierId: fichierSignale.id,
            typeEmplacement: typeCible,
            emplacementId: cibleId,
            libelle: fichierSignale.description || fichierSignale.nom_fichier,
          }}
          onFermer={() => setFichierSignale(null)}
        />
      )}
    </div>
  );
}
