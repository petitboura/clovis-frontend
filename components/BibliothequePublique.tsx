"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo, Download, Flag,
} from "lucide-react";
import Link from "next/link";
import {
  listerBibliothequePublique,
  ajouterABibliothequePublique,
  supprimerDeBibliothequePublique,
  type EntreeBibliothequePublique,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { Skeleton } from "./Skeleton";

function iconePourType(typeMime: string | null) {
  if (!typeMime) return Paperclip;
  if (typeMime === "text/plain") return FileText;
  if (typeMime.startsWith("image/")) return IconImage;
  if (typeMime.startsWith("audio/")) return IconAudio;
  if (typeMime.startsWith("video/")) return IconVideo;
  return Paperclip;
}

// Onglet "Bibliothèque publique" (21/08/2026, demande Bourama : "un
// bibliothèque publique dans la section bibliothèque, tout le monde
// peut y ajouter des documents, juste en le décrivant et en donnant un
// nom"). CORRECTION le même jour (malentendu de ma part sur cette
// phrase) : "nom" et "description" accompagnent un VRAI fichier
// uploadé -- ce n'est pas un catalogue de simples liens/notes. Voir
// api/bibliotheque_publique.py côté backend.
//
// Passée d'une fonctionnalité légère à un composant à part entière le
// 22/08 (demande Bourama : "rendre la section bibliothèque plus
// sérieuse, notamment la version publique"), ajout du signalement
// par contenu (SignalerContenuModal, voir aussi le guide Notion "Guide
// pour droit d'auteur") et des liens vers les CGU/politique de
// copyright (api/contenu_legal.py, pages /cgu et /copyright).
export function BibliothequePublique() {
  const [liste, setListe] = useState<EntreeBibliothequePublique[] | undefined>(undefined);
  const [recherche, setRecherche] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);
  const [entreeSignalee, setEntreeSignalee] = useState<EntreeBibliothequePublique | null>(null);
  const inputFichierRef = useRef<HTMLInputElement>(null);

  function charger(q?: string) {
    listerBibliothequePublique(q)
      .then(setListe)
      .catch(() => setListe([]));
  }

  useEffect(() => {
    charger();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => charger(recherche), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  function choisirFichier(f: File) {
    setFichier(f);
    if (!nom.trim()) setNom(f.name.replace(/\.[^/.]+$/, "")); // nom du fichier sans extension comme point de départ, modifiable
  }

  async function ajouter() {
    if (!fichier || !nom.trim()) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await ajouterABibliothequePublique(fichier, nom, description);
      setFichier(null);
      setNom("");
      setDescription("");
      setFormulaireOuvert(false);
      charger(recherche);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer(id: string, nomEntree: string) {
    if (!window.confirm(`Retirer « ${nomEntree} » de la bibliothèque publique ?`)) return;
    try {
      await supprimerDeBibliothequePublique(id);
      charger(recherche);
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour ajouter un document à la bibliothèque publique." />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Un catalogue de documents partagé par tout le monde : uploade un fichier avec un nom et une description
        pour que les autres le retrouvent facilement. En publiant, tu garantis détenir les droits sur ce contenu,
        voir les{" "}
        <Link href="/cgu" className="text-dj-accent-1 hover:underline">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/copyright" className="text-dj-accent-1 hover:underline">
          politique de copyright
        </Link>
        .
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dj-texte-muet" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher dans la bibliothèque publique..."
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-9 pr-3 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
        />
      </div>

      {!formulaireOuvert ? (
        <button
          onClick={() => setFormulaireOuvert(true)}
          className="flex items-center justify-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute"
        >
          <Plus size={16} /> Ajouter un document
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <input
            ref={inputFichierRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && choisirFichier(e.target.files[0])}
          />
          <button
            onClick={() => inputFichierRef.current?.click()}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dashed border-dj-bordure px-4 py-3 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
          >
            <Paperclip size={15} />
            {fichier ? fichier.name : "Choisir un fichier..."}
          </button>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom du document"
            className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décris-le en quelques mots"
            rows={3}
            className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setFormulaireOuvert(false);
                setFichier(null);
              }}
              className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
            >
              Annuler
            </button>
            <button
              onClick={ajouter}
              disabled={!fichier || !nom.trim() || envoi}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoi ? "Envoi…" : "Ajouter"}
            </button>
          </div>
        </div>
      )}

      {liste === undefined && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}
      {liste?.length === 0 && (
        <p className="text-sm text-dj-texte-muet">
          {recherche ? "Aucun résultat pour cette recherche." : "Rien ici pour l'instant."}
        </p>
      )}
      {liste && liste.length > 0 && (
        <div className="flex flex-col gap-2">
          {liste.map((entree) => {
            const Icone = iconePourType(entree.type_mime);
            return (
              <div
                key={entree.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Icone size={16} className="flex-shrink-0 text-dj-accent-1" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte">{entree.nom}</p>
                    {entree.description && (
                      <p className="truncate text-xs text-dj-texte-muet">{entree.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {entree.url_publique && (
                    <a
                      href={entree.url_publique}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir / télécharger"
                      className="text-dj-texte-muet transition-colors hover:text-dj-accent-1"
                    >
                      <Download size={15} />
                    </a>
                  )}
                  <button
                    onClick={() => setEntreeSignalee(entree)}
                    title="Signaler ce contenu"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Flag size={14} />
                  </button>
                  <button
                    onClick={() => supprimer(entree.id, entree.nom)}
                    title="Retirer (uniquement si c'est toi qui l'as ajouté)"
                    className="text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entreeSignalee && (
        <SignalerContenuModal
          cible={{
            typeSignalement: "bibliotheque_publique",
            bibliothequePubliqueId: entreeSignalee.id,
            libelle: entreeSignalee.nom,
          }}
          onFermer={() => setEntreeSignalee(null)}
        />
      )}
    </div>
  );
}
