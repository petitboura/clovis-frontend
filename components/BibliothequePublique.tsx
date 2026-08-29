"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Trash2, Paperclip, FileText, Image as IconImage, Music as IconAudio, Video as IconVideo,
  Flag, FolderPlus, Check, Link as IconLien, Upload, FolderX, X, Globe, Lock,
} from "lucide-react";
import Link from "next/link";
import {
  listerBibliothequePublique,
  ajouterABibliothequePublique,
  ajouterFichiersABibliothequePublique,
  ajouterLienBibliothequePublique,
  ajouterTexteBibliothequePublique,
  supprimerDeBibliothequePublique,
  copierVersBibliothequePersonnelle,
  listerDossiersCataloguePublic,
  creerDossierCataloguePublic,
  supprimerDossierCataloguePublic,
  type EntreeBibliothequePublique,
  type DossierCataloguePublic,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { CompteRequisModal } from "@/components/CompteRequisModal";
import { SignalerContenuModal } from "@/components/SignalerContenuModal";
import { VisionneuseBibliotheque } from "@/components/VisionneuseBibliotheque";
import { Skeleton } from "./Skeleton";

function iconePourType(typeMime: string | null) {
  if (!typeMime) return Paperclip;
  if (typeMime === "text/uri-list") return IconLien;
  if (typeMime === "text/plain") return FileText;
  if (typeMime?.startsWith("image/")) return IconImage;
  if (typeMime?.startsWith("audio/")) return IconAudio;
  if (typeMime?.startsWith("video/")) return IconVideo;
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
// REFONTE 28/08/2026 (demande Bourama : "le bouton + doit être comme
// en privé, pour un fichier nom/description optionnels, même pour un
// dossier") : bouton flottant unique (Fichier(s) / Texte / Lien /
// Nouveau dossier), même principe que EspaceBibliotheque.tsx. Dossiers
// du catalogue public : statut "contribution_libre" (tout le monde
// peut y ranger un document) ou "privee" (seul le créateur), choisi à
// la création -- voir core/dossiers_catalogue_public.py.
//
// Multi-fichiers (28/08/2026 bis, demande Bourama : "on ne peut pas
// ajouter plusieurs fichiers en un coup") : input file `multiple`.
// 1 fichier -> nom/description modifiables (optionnels). Plusieurs
// fichiers -> nom auto par fichier, pas de description, même choix que
// EspaceBibliotheque.tsx pour le cas multi (ajouterFichiersABibliothequePublique
// dans lib/api.ts, boucle séquentielle).
export function BibliothequePublique() {
  const [liste, setListe] = useState<EntreeBibliothequePublique[] | undefined>(undefined);
  const [dossiers, setDossiers] = useState<DossierCataloguePublic[]>([]);
  const [dossierCourantId, setDossierCourantId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursEnvoi, setErreursEnvoi] = useState<{ nom: string; erreur: string }[]>([]);
  const [sansCompte, setSansCompte] = useState(false);
  const [entreeSignalee, setEntreeSignalee] = useState<EntreeBibliothequePublique | null>(null);
  const [entreeOuverte, setEntreeOuverte] = useState<EntreeBibliothequePublique | null>(null);
  const [copieEnCours, setCopieEnCours] = useState<string | null>(null);
  const [copieReussie, setCopieReussie] = useState<string | null>(null);
  const [compteRequisPourCopie, setCompteRequisPourCopie] = useState(false);

  // Sélecteur flottant "+" (même principe que EspaceBibliotheque.tsx).
  const [menuAjoutOuvert, setMenuAjoutOuvert] = useState(false);
  const [modaleFichierOuverte, setModaleFichierOuverte] = useState(false);
  const [modaleAjout, setModaleAjout] = useState<"texte" | "lien" | null>(null);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [texteOuLien, setTexteOuLien] = useState("");
  const inputFichierRef = useRef<HTMLInputElement>(null);

  const [creationDossierOuverte, setCreationDossierOuverte] = useState(false);
  const [nouveauNomDossier, setNouveauNomDossier] = useState("");
  const [nouveauStatutDossier, setNouveauStatutDossier] = useState<"contribution_libre" | "privee">("contribution_libre");

  function charger(q?: string) {
    listerBibliothequePublique(q)
      .then(setListe)
      .catch(() => setListe([]));
  }

  function chargerDossiers() {
    listerDossiersCataloguePublic()
      .then(setDossiers)
      .catch(() => setDossiers([]));
  }

  useEffect(() => {
    charger();
    chargerDossiers();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => charger(recherche), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  function choisirFichiers(fichiersChoisis: FileList | File[]) {
    const liste = Array.from(fichiersChoisis);
    if (liste.length === 0) return;
    setFichiers(liste);
    if (liste.length === 1 && !nom.trim()) {
      setNom(liste[0].name.replace(/\.[^/.]+$/, "")); // nom du fichier sans extension comme point de départ, modifiable
    }
    setModaleFichierOuverte(true);
  }

  function retirerFichier(f: File) {
    setFichiers((liste) => liste.filter((x) => x !== f));
  }

  // Nom optionnel (28/08, demande Bourama : "nom et description
  // optionnels même pour dossier") -- l'API se rabat sur le nom du
  // fichier si vide. Cas multi-fichiers : pas de nom/description
  // saisis, chacun garde son nom de fichier (voir lib/api.ts).
  async function ajouterFichier() {
    if (fichiers.length === 0) return;
    setEnvoi(true);
    setErreur(null);
    setErreursEnvoi([]);
    try {
      if (fichiers.length === 1) {
        await ajouterABibliothequePublique(fichiers[0], nom, description, dossierCourantId || undefined);
      } else {
        const erreurs = await ajouterFichiersABibliothequePublique(fichiers);
        if (erreurs.length === fichiers.length) {
          setEnvoi(false);
          setSansCompte(true);
          return;
        }
        setErreursEnvoi(erreurs);
      }
      setFichiers([]);
      setNom("");
      setDescription("");
      setModaleFichierOuverte(false);
      charger(recherche);
      chargerDossiers();
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

  async function envoyerTexteOuLien() {
    const contenu = texteOuLien.trim();
    if (!contenu) return;
    const titre = nom.trim();
    setEnvoi(true);
    setErreur(null);
    try {
      if (modaleAjout === "lien") {
        await ajouterLienBibliothequePublique(contenu, titre || undefined, description || undefined, dossierCourantId || undefined);
      } else {
        await ajouterTexteBibliothequePublique(contenu, titre || undefined, dossierCourantId || undefined);
      }
      setTexteOuLien("");
      setNom("");
      setDescription("");
      setModaleAjout(null);
      charger(recherche);
      chargerDossiers();
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

  async function creerDossier() {
    // Nom optionnel (28/08, demande Bourama) -- l'API se rabat sur "Nouveau dossier" si vide.
    try {
      await creerDossierCataloguePublic(nouveauNomDossier.trim(), nouveauStatutDossier);
      setNouveauNomDossier("");
      setCreationDossierOuverte(false);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  async function supprimerDossier(d: DossierCataloguePublic) {
    if (!window.confirm(`Supprimer le dossier « ${d.nom} » ? (les documents qu'il contient restent dans le catalogue)`)) return;
    try {
      await supprimerDossierCataloguePublic(d.id);
      if (dossierCourantId === d.id) setDossierCourantId(null);
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
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
      chargerDossiers();
    } catch (e) {
      window.alert(messageErreur(e));
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour ajouter un document à la bibliothèque publique." />;
  }

  const dossiersRacine = dossiers.filter((d) => !d.dossier_parent_id);
  const dossierActuel = dossierCourantId ? dossiers.find((d) => d.id === dossierCourantId) : null;
  const listeAffichee = dossierCourantId
    ? (liste || []).filter((e) => dossierActuel?.fichier_ids.includes(e.id))
    : liste;

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Un catalogue de documents partagé par tout le monde : ajoute un fichier, un lien ou une note avec un nom et
        une description pour que les autres le retrouvent facilement. En publiant, tu garantis détenir les droits sur
        ce contenu, voir les{" "}
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setDossierCourantId(null)}
          className={`rounded-cgpt-bouton px-2 py-1 font-semibold transition-colors ${
            dossierCourantId === null ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Tous
        </button>
        {dossiersRacine.map((d) => (
          <span key={d.id} className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1">
            <button
              onClick={() => setDossierCourantId(d.id)}
              title={d.statut === "contribution_libre" ? "Contribution libre : tout le monde peut y ajouter" : "Privé : seul le créateur peut y ajouter"}
              className={`flex items-center gap-1 font-semibold transition-colors ${
                dossierCourantId === d.id ? "text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              {d.statut === "contribution_libre" ? <Globe size={12} /> : <Lock size={12} />}
              {d.nom}
            </button>
            <button onClick={() => supprimerDossier(d)} className="text-dj-texte-muet hover:text-[var(--dj-erreur)]" title="Supprimer le dossier">
              <FolderX size={12} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setCreationDossierOuverte((v) => !v)}
          className="flex items-center gap-1 rounded-cgpt-bouton px-2 py-1 font-semibold text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          <FolderPlus size={14} />
          Nouveau dossier
        </button>
      </div>

      {creationDossierOuverte && (
        <div className="flex animate-dj-fade-in-rapide items-center gap-2">
          <input
            autoFocus
            type="text"
            value={nouveauNomDossier}
            onChange={(e) => setNouveauNomDossier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && creerDossier()}
            placeholder="Nom du dossier… (optionnel)"
            className="flex-1 rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <select
            value={nouveauStatutDossier}
            onChange={(e) => setNouveauStatutDossier(e.target.value as "contribution_libre" | "privee")}
            className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-2 py-1.5 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
          >
            <option value="contribution_libre">Contribution libre</option>
            <option value="privee">Privé (moi seul)</option>
          </select>
          <button
            onClick={creerDossier}
            className="rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] hover:bg-dj-accent-2"
          >
            Créer
          </button>
          <button
            onClick={() => {
              setCreationDossierOuverte(false);
              setNouveauNomDossier("");
            }}
            className="text-dj-texte-muet hover:text-dj-texte"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {erreursEnvoi.length > 0 && (
        <div className="flex flex-col gap-1 rounded-cgpt-carte border border-[var(--dj-erreur)] bg-dj-surface p-3 text-xs text-[var(--dj-erreur)]">
          {erreursEnvoi.map((e, i) => (
            <p key={i}>« {e.nom} » : {e.erreur}</p>
          ))}
        </div>
      )}

      {liste === undefined && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}
      {listeAffichee?.length === 0 && (
        <p className="text-sm text-dj-texte-muet">
          {recherche ? "Aucun résultat pour cette recherche." : "Rien ici pour l'instant."}
        </p>
      )}
      {listeAffichee && listeAffichee.length > 0 && (
        <div className="flex flex-col gap-2">
          {listeAffichee.map((entree) => {
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

      {/* 28/08/2026, refonte "Ajouter" (demande Bourama : "le bouton +
          doit être comme en privé") : bouton flottant unique, même
          principe que EspaceBibliotheque.tsx -- Fichier(s) / Texte /
          Lien. "Nouveau dossier" reste géré au-dessus (barre de
          dossiers), pas dans ce menu, pour rester cohérent avec la
          navigation par dossiers déjà affichée. */}
      <input
        ref={inputFichierRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) choisirFichiers(e.target.files);
          e.target.value = "";
          setMenuAjoutOuvert(false);
        }}
      />

      {menuAjoutOuvert && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuAjoutOuvert(false)} />
      )}
      {menuAjoutOuvert && (
        <div className="fixed bottom-[calc(8.25rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex animate-dj-fade-in-rapide flex-col items-end gap-2">
          <button
            onClick={() => {
              inputFichierRef.current?.click();
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Importer des fichiers
            <Upload size={15} />
          </button>
          <button
            onClick={() => {
              setModaleAjout("texte");
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Texte
            <FileText size={15} />
          </button>
          <button
            onClick={() => {
              setModaleAjout("lien");
              setMenuAjoutOuvert(false);
            }}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-4 py-2 text-sm font-medium text-dj-texte shadow-lg transition-colors hover:border-dj-bordure-forte"
          >
            Lien
            <IconLien size={15} />
          </button>
        </div>
      )}
      <button
        onClick={() => setMenuAjoutOuvert((v) => !v)}
        aria-label={menuAjoutOuvert ? "Fermer le menu d'ajout" : "Ajouter"}
        className="fixed bottom-[calc(5rem+var(--cap-native-navigation-bottom,0px))] right-5 z-40 flex h-10 w-10 items-center justify-center rounded-cgpt-bouton bg-dj-accent-1 text-[#1A0D02] shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-transform hover:bg-dj-accent-2"
      >
        <Plus size={18} className={`transition-transform ${menuAjoutOuvert ? "rotate-45" : ""}`} />
      </button>

      {modaleFichierOuverte && fichiers.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModaleFichierOuverte(false)}>
          <div
            className="flex w-full max-w-sm animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {fichiers.length === 1 ? (
              <>
                <p className="flex items-center gap-2 text-sm text-dj-texte-muet">
                  <Paperclip size={15} /> {fichiers[0].name}
                </p>
                <input
                  autoFocus
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Nom du document (optionnel)"
                  className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décris-le en quelques mots (optionnel)"
                  rows={3}
                  className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-dj-texte-muet">{fichiers.length} fichiers -- chacun garde son nom, pas de description.</p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {fichiers.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte">
                      <span className="truncate">{f.name}</span>
                      <button onClick={() => retirerFichier(f)} className="text-dj-texte-muet hover:text-[var(--dj-erreur)]">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setModaleFichierOuverte(false);
                  setFichiers([]);
                  setNom("");
                  setDescription("");
                }}
                className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                Annuler
              </button>
              <button
                onClick={ajouterFichier}
                disabled={envoi || fichiers.length === 0}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                {envoi ? "Envoi…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleAjout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModaleAjout(null)}>
          <div
            className="flex w-full max-w-sm animate-dj-fade-in-rapide flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-dj-texte">
              {modaleAjout === "lien" ? "Ajouter un lien" : "Ajouter un texte"}
            </p>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom (optionnel)"
              className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
            {modaleAjout === "lien" ? (
              <input
                autoFocus
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                placeholder="https://…"
                className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            ) : (
              <textarea
                autoFocus
                value={texteOuLien}
                onChange={(e) => setTexteOuLien(e.target.value)}
                placeholder="Ton texte…"
                rows={5}
                className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            )}
            {modaleAjout === "lien" && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décris-le en quelques mots (optionnel)"
                rows={2}
                className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            )}
            {erreur && <p className="text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setModaleAjout(null);
                  setTexteOuLien("");
                  setNom("");
                  setDescription("");
                }}
                className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                Annuler
              </button>
              <button
                onClick={envoyerTexteOuLien}
                disabled={!texteOuLien.trim() || envoi}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                {envoi ? "Envoi…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
