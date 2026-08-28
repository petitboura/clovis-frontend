"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo, Download,
  Flag, FolderPlus, Check, X,
} from "lucide-react";
import Link from "next/link";
import {
  listerBibliothequePublique,
  ajouterABibliothequePublique,
  ajouterFichiersABibliothequePublique,
  supprimerDeBibliothequePublique,
  copierVersBibliothequePersonnelle,
  type EntreeBibliothequePublique,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { VisionneuseBibliotheque } from "@/components/VisionneuseBibliotheque";
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
//
// 28/08/2026, demande Bourama : "on ne peut pas ajouter plusieurs
// fichiers en un coup". Input file passé en `multiple`, state fichier
// devenu un tableau. Choix de Bourama sur nom/description dans ce cas :
// 1 fichier -> comportement inchangé (nom + description saisis à la
// main) ; plusieurs fichiers -> nom auto (nom du fichier) par fichier,
// pas de description du tout, formulaire nom/description masqué. Voir
// ajouterFichiersABibliothequePublique dans lib/api.ts (même pattern
// que ajouterFichiersBibliothequePersonnelle : boucle séquentielle, pas
// d'endpoint bulk dédié côté backend).
export function BibliothequePublique() {
  const [liste, setListe] = useState<EntreeBibliothequePublique[] | undefined>(undefined);
  const [recherche, setRecherche] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Rempli seulement dans le cas multi-fichiers (28/08/2026, demande
  // Bourama : "on ne peut pas ajouter plusieurs fichiers en un coup") --
  // même pattern que erreursEnvoi dans EspaceBibliotheque.tsx : chaque
  // fichier est envoyé séquentiellement, un échec n'empêche pas les
  // autres, on affiche la liste des échecs à la fin.
  const [erreursEnvoi, setErreursEnvoi] = useState<{ nom: string; erreur: string }[]>([]);
  const [sansCompte, setSansCompte] = useState(false);
  const [entreeSignalee, setEntreeSignalee] = useState<EntreeBibliothequePublique | null>(null);
  const [entreeOuverte, setEntreeOuverte] = useState<EntreeBibliothequePublique | null>(null);
  const [copieEnCours, setCopieEnCours] = useState<string | null>(null);
  const [copieReussie, setCopieReussie] = useState<string | null>(null);
  const [compteRequisPourCopie, setCompteRequisPourCopie] = useState(false);
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

  // 28/08/2026, demande Bourama : plusieurs fichiers en un coup. Choix
  // de Bourama sur nom/description dans ce cas : un seul fichier ->
  // comportement inchangé (nom modifiable, description modifiable) ;
  // plusieurs fichiers -> nom auto (nom du fichier) par fichier, pas de
  // description du tout, donc les champs nom/description sont masqués
  // dans le formulaire quand fichiers.length > 1 (voir plus bas).
  function choisirFichiers(fichiersChoisis: FileList | File[]) {
    const liste = Array.from(fichiersChoisis);
    if (liste.length === 0) return;
    setFichiers(liste);
    if (liste.length === 1 && !nom.trim()) {
      setNom(liste[0].name.replace(/\.[^/.]+$/, "")); // nom du fichier sans extension comme point de départ, modifiable
    }
  }

  function retirerFichier(f: File) {
    setFichiers((liste) => liste.filter((x) => x !== f));
  }

  async function ajouter() {
    if (fichiers.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    setErreursEnvoi([]);
    try {
      if (fichiers.length === 1) {
        // Un seul fichier : comportement inchangé, nom obligatoire saisi par l'utilisateur.
        if (!nom.trim()) {
          setEnvoi(false);
          return;
        }
        await ajouterABibliothequePublique(fichiers[0], nom, description);
      } else {
        const erreurs = await ajouterFichiersABibliothequePublique(fichiers);
        if (erreurs.length === fichiers.length) {
          // Tout a échoué : probablement pas connecté, même traitement que le cas single-fichier.
          setEnvoi(false);
          setSansCompte(true);
          return;
        }
        setErreursEnvoi(erreurs);
      }
      setFichiers([]);
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

  // 25/08, Bourama : "rendre les fichiers de la bibliothèque publique
  // uploadables/copiables vers ta bibliothèque privée". copieReussie
  // affiche brièvement une coche à la place de l'icône (transition
  // douce, cohérent avec la règle "jamais d'affichage brut") avant de
  // revenir à l'icône copier.
  async function copierVersBiblioPerso(entree: EntreeBibliothequePublique) {
    setCopieEnCours(entree.id);
    try {
      await copierVersBibliothequePersonnelle(entree.id);
      setCopieReussie(entree.id);
      setTimeout(() => setCopieReussie((id) => (id === entree.id ? null : id)), 2000);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setCompteRequisPourCopie(true);
      } else {
        window.alert(messageErreur(e));
      }
    } finally {
      setCopieEnCours(null);
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
        <Link href="/cgu" className="text-dj-texte-muet hover:text-dj-texte hover:underline">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/copyright" className="text-dj-texte-muet hover:text-dj-texte hover:underline">
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
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-9 pr-3 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
      </div>

      {!formulaireOuvert ? (
        <button
          onClick={() => {
            setErreur(null);
            setErreursEnvoi([]);
            setFormulaireOuvert(true);
          }}
          className="flex items-center justify-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute"
        >
          <Plus size={16} /> Ajouter un document
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <input
            ref={inputFichierRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && choisirFichiers(e.target.files)}
          />
          <button
            onClick={() => inputFichierRef.current?.click()}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dashed border-dj-bordure px-4 py-3 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
          >
            <Paperclip size={15} />
            {fichiers.length === 0
              ? "Choisir un ou plusieurs fichiers..."
              : fichiers.length === 1
                ? fichiers[0].name
                : `${fichiers.length} fichiers sélectionnés`}
          </button>

          {/* Plusieurs fichiers : liste avec retrait individuel, pas de nom/description
              (choix de Bourama, 28/08/2026) -- nom auto par fichier côté envoi. */}
          {fichiers.length > 1 && (
            <div className="flex flex-col gap-1">
              {fichiers.map((f) => (
                <div
                  key={`${f.name}-${f.lastModified}`}
                  className="flex items-center justify-between gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-2 text-xs text-dj-texte-muet"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    onClick={() => retirerFichier(f)}
                    title="Retirer ce fichier de la sélection"
                    className="flex-shrink-0 text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {fichiers.length <= 1 && (
            <>
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
            </>
          )}

          {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}

          {erreursEnvoi.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-[var(--dj-erreur)]/40 bg-[var(--dj-erreur)]/5 px-4 py-3">
              {erreursEnvoi.map((e) => (
                <p key={e.nom} className="text-xs text-[var(--dj-erreur)]">
                  {e.nom} : {e.erreur}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setFormulaireOuvert(false);
                setFichiers([]);
                setErreur(null);
                setErreursEnvoi([]);
              }}
              className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
            >
              Annuler
            </button>
            <button
              onClick={ajouter}
              disabled={fichiers.length === 0 || (fichiers.length === 1 && !nom.trim()) || envoi}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoi ? "Envoi…" : fichiers.length > 1 ? `Ajouter (${fichiers.length})` : "Ajouter"}
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
                <button
                  onClick={() => entree.url_publique && setEntreeOuverte(entree)}
                  disabled={!entree.url_publique}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <Icone size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte group-hover:underline">{entree.nom}</p>
                    {entree.description && (
                      <p className="truncate text-xs text-dj-texte-muet">{entree.description}</p>
                    )}
                  </div>
                </button>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {entree.url_publique && (
                    <button
                      onClick={() => copierVersBiblioPerso(entree)}
                      disabled={copieEnCours === entree.id}
                      title="Copier dans ma bibliothèque"
                      className="text-dj-texte-muet transition-colors hover:text-dj-texte disabled:opacity-50"
                    >
                      {copieReussie === entree.id ? (
                        <Check size={15} className="text-dj-accent-1" />
                      ) : (
                        <FolderPlus size={15} />
                      )}
                    </button>
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

      <VisionneuseBibliotheque
        fichier={
          entreeOuverte && entreeOuverte.url_publique
            ? {
                id: entreeOuverte.id,
                nom_fichier: entreeOuverte.nom_fichier || entreeOuverte.nom,
                type_mime: entreeOuverte.type_mime || "application/octet-stream",
                description: entreeOuverte.description || entreeOuverte.nom,
                url_publique: entreeOuverte.url_publique,
                created_at: entreeOuverte.created_at,
              }
            : null
        }
        onFermer={() => setEntreeOuverte(null)}
      />

      {compteRequisPourCopie && (
        <CompteRequisModal
          texte="Crée un compte pour copier ce document dans ta bibliothèque."
          onFerme={() => setCompteRequisPourCopie(false)}
        />
      )}
    </div>
  );
}
