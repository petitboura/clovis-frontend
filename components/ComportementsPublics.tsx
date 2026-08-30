"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ScrollText, Download, Check, Upload, Plus, Loader2 } from "lucide-react";
import {
  rechercherComportementsPublics,
  activerComportementPublic,
  uploaderSkillPublic,
  type ComportementPublic,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { telechargerTexte, nomFichierDepuis } from "@/lib/telechargerTexte";
import { Skeleton } from "./Skeleton";

// Catalogue public des comportements (21/08/2026, demande Bourama : "les
// comportements aussi, je veux un onglet public, c'est à dire quelqu'un
// peut l'uploader et l'activer"). Même esprit que EspacePlugins.tsx :
// recherche publique (pas de compte requis pour consulter), activation
// gatée par un compte (crée une copie perso dans "Mes comportements",
// voir api/comportements_publics.py::activer_comportement_public).
export function ComportementsPublics({ onActive }: { onActive: () => void }) {
  const [liste, setListe] = useState<ComportementPublic[] | undefined>(undefined);
  const [recherche, setRecherche] = useState("");
  const [activationEnCours, setActivationEnCours] = useState<string | null>(null);
  const [actives, setActives] = useState<Set<string>>(new Set());
  const [sansCompte, setSansCompte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [fichierUpload, setFichierUpload] = useState<File | null>(null);
  const [fichiersUploadLot, setFichiersUploadLot] = useState<File[]>([]);
  const [nomUpload, setNomUpload] = useState("");
  const [descriptionUpload, setDescriptionUpload] = useState("");
  const [envoiUpload, setEnvoiUpload] = useState(false);
  const [erreurUpload, setErreurUpload] = useState<string | null>(null);
  const [erreursUploadLot, setErreursUploadLot] = useState<{ nom: string; erreur: string }[]>([]);
  const inputFichierRef = useRef<HTMLInputElement>(null);

  function charger(q?: string) {
    rechercherComportementsPublics(q)
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

  async function activer(c: ComportementPublic) {
    if (activationEnCours) return;
    setActivationEnCours(c.id);
    setErreur(null);
    try {
      await activerComportementPublic(c.id);
      setActives((prec) => new Set(prec).add(c.id));
      onActive(); // recharge "Mes comportements" pour que la copie apparaisse tout de suite
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreur(messageErreur(e));
      }
    } finally {
      setActivationEnCours(null);
    }
  }

  // 25/08/2026, demande Bourama ("les skills soient téléchargeables en
  // fichier MD") : le contenu est déjà en mémoire (skill_md dans la
  // liste chargée), pas besoin d'appel réseau -- juste un Blob local.
  function telechargerSkill(c: ComportementPublic) {
    telechargerTexte(nomFichierDepuis(c.nom, "md"), c.skill_md);
  }

  function choisirFichiersUpload(fichiers: FileList) {
    const liste = Array.from(fichiers).filter((f) => /\.md$/i.test(f.name));
    if (liste.length === 0) return;
    if (liste.length === 1) {
      setFichierUpload(liste[0]);
      setFichiersUploadLot([]);
      if (!nomUpload.trim()) setNomUpload(liste[0].name.replace(/\.md$/i, ""));
    } else {
      setFichierUpload(null);
      setFichiersUploadLot(liste);
      setNomUpload("");
    }
  }

  // 25/08/2026, demande Bourama ("on peut y téléverser... depuis la
  // section skill publique") : uploadé ici, un skill est publié
  // IMMÉDIATEMENT pour tout le monde (confirmé par Bourama), contrairement
  // à "Mes comportements" où publier reste une action séparée.
  async function uploaderSkill() {
    if (!fichierUpload || !nomUpload.trim()) return;
    setEnvoiUpload(true);
    setErreurUpload(null);
    try {
      const cree = await uploaderSkillPublic(fichierUpload, nomUpload, descriptionUpload);
      setListe((prec) => [cree, ...(prec || [])]);
      setFichierUpload(null);
      setNomUpload("");
      setDescriptionUpload("");
      setFormulaireOuvert(false);
    } catch (e) {
      if (e instanceof ErreurApi && e.statusCode === 401) {
        setSansCompte(true);
      } else {
        setErreurUpload(messageErreur(e));
      }
    } finally {
      setEnvoiUpload(false);
    }
  }

  // 29/08/2026, demande Bourama : publier plusieurs skills publics en une
  // fois. Chaque fichier garde son propre nom (déduit du nom de fichier,
  // pas éditable individuellement -- éditer n noms un par un n'aurait
  // pas de sens ici) ; la description saisie dans le formulaire (si
  // remplie) s'applique à tous. Import séquentiel, une erreur sur un
  // fichier n'empêche pas les suivants.
  async function uploaderPlusieursSkills() {
    if (fichiersUploadLot.length === 0) return;
    setEnvoiUpload(true);
    setErreurUpload(null);
    setErreursUploadLot([]);
    const erreurs: { nom: string; erreur: string }[] = [];
    const creees: ComportementPublic[] = [];

    for (const f of fichiersUploadLot) {
      const nom = f.name.replace(/\.md$/i, "");
      try {
        const cree = await uploaderSkillPublic(f, nom, descriptionUpload);
        creees.push(cree);
      } catch (e) {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
          break;
        }
        erreurs.push({ nom: f.name, erreur: messageErreur(e) });
      }
    }

    if (creees.length > 0) {
      setListe((prec) => [...creees, ...(prec || [])]);
    }
    setErreursUploadLot(erreurs);
    setEnvoiUpload(false);
    if (erreurs.length === 0) {
      setFichiersUploadLot([]);
      setDescriptionUpload("");
      setFormulaireOuvert(false);
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour activer un skill publié par la communauté." />;
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
      <p className="text-sm text-dj-texte-muet">
        Des comportements publiés par d&apos;autres étudiants. Active celui qui t&apos;intéresse : une copie
        s&apos;ajoute directement dans &laquo;&nbsp;Mes comportements&nbsp;&raquo;, prête à l&apos;emploi.
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dj-texte-muet" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un skill public..."
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2 pl-9 pr-3 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
      </div>

      {!formulaireOuvert ? (
        <button
          onClick={() => setFormulaireOuvert(true)}
          className="flex w-fit items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface px-3 py-1.5 text-xs font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute"
        >
          <Plus size={14} /> Ajouter un skill
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <input
            ref={inputFichierRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) choisirFichiersUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputFichierRef.current?.click()}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dashed border-dj-bordure px-4 py-3 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
          >
            <Upload size={15} />
            {fichierUpload
              ? fichierUpload.name
              : fichiersUploadLot.length > 0
                ? `${fichiersUploadLot.length} fichiers sélectionnés`
                : "Choisir un ou plusieurs fichiers .md..."}
          </button>

          {fichiersUploadLot.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-dj-texte-muet">
              {fichiersUploadLot.map((f) => (
                <li key={f.name} className="truncate">· {f.name.replace(/\.md$/i, "")}</li>
              ))}
            </ul>
          )}

          {fichierUpload && (
            <input
              value={nomUpload}
              onChange={(e) => setNomUpload(e.target.value)}
              placeholder="Nom du skill"
              className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
          )}
          <textarea
            value={descriptionUpload}
            onChange={(e) => setDescriptionUpload(e.target.value)}
            placeholder={fichiersUploadLot.length > 0 ? "Description commune (optionnel)" : "Décris-le en quelques mots"}
            rows={3}
            className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <p className="text-xs text-dj-texte-muet">Publié immédiatement, visible par tout le monde.</p>
          {erreurUpload && <p className="text-xs text-[var(--dj-erreur)]">{erreurUpload}</p>}
          {erreursUploadLot.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-[var(--dj-erreur)] px-3 py-2 text-xs text-[var(--dj-erreur)]">
              <p className="font-medium">
                {erreursUploadLot.length} fichier{erreursUploadLot.length > 1 ? "s n'ont" : " n'a"} pas pu être publié{erreursUploadLot.length > 1 ? "s" : ""} :
              </p>
              {erreursUploadLot.map((e, i) => (
                <p key={i}>« {e.nom} » : {e.erreur}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setFormulaireOuvert(false);
                setFichierUpload(null);
                setFichiersUploadLot([]);
                setErreursUploadLot([]);
              }}
              className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
            >
              Annuler
            </button>
            <button
              onClick={fichiersUploadLot.length > 0 ? uploaderPlusieursSkills : uploaderSkill}
              disabled={(!fichierUpload && fichiersUploadLot.length === 0) || (!!fichierUpload && !nomUpload.trim()) || envoiUpload}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoiUpload
                ? "Envoi…"
                : fichiersUploadLot.length > 0
                  ? `Publier (${fichiersUploadLot.length})`
                  : "Publier"}
            </button>
          </div>
        </div>
      )}

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {/* Skeleton précis (30/08, audit) : ici c'est bien une ligne pleine
          largeur (contrairement à "Mes comportements" qui sont des
          pilules) -- icône plate 16px + titre + sous-titre (description
          + nombre d'activations, 2 lignes) + 2 boutons à droite (Activer,
          Télécharger). 5 lignes au lieu de 2 fixes. */}
      {liste === undefined && (
        <div className="flex flex-col gap-2" aria-hidden>
          {[
            { titre: "w-1/2", soustitre: "w-2/5", delai: "0ms" },
            { titre: "w-3/5", soustitre: "w-1/3", delai: "100ms" },
            { titre: "w-2/5", soustitre: "w-1/2", delai: "200ms" },
            { titre: "w-3/4", soustitre: "w-1/4", delai: "300ms" },
            { titre: "w-1/3", soustitre: "w-2/5", delai: "400ms" },
          ].map(({ titre, soustitre, delai }, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className={`h-3.5 rounded ${titre}`} style={{ animationDelay: delai }} />
                  <Skeleton className={`h-2.5 rounded ${soustitre}`} style={{ animationDelay: delai }} />
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Skeleton className="h-7 w-20 rounded-cgpt-bouton border border-dj-bordure" style={{ animationDelay: delai }} />
                <Skeleton className="h-7 w-7 rounded-cgpt-bouton border border-dj-bordure" style={{ animationDelay: delai }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {liste && liste.length === 0 && (
        <p className="text-sm text-dj-texte-muet">
          {recherche ? "Aucun résultat pour cette recherche." : "Rien de publié pour l'instant."}
        </p>
      )}

      {liste && liste.length > 0 && (
        <div className="flex flex-col gap-2">
          {liste.map((c) => {
            const dejaActive = actives.has(c.id);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ScrollText size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-dj-texte">{c.nom}</p>
                    <p className="truncate text-xs text-dj-texte-muet">
                      {c.description || c.texte} · {c.activations_count} activation(s)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => activer(c)}
                  disabled={activationEnCours === c.id || dejaActive}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-60"
                >
                  {dejaActive ? (
                    <>
                      <Check size={13} /> Activé
                    </>
                  ) : (
                    <>
                      <Plus size={13} /> {activationEnCours === c.id ? "Activation…" : "Activer"}
                    </>
                  )}
                </button>
                <button
                  onClick={() => telechargerSkill(c)}
                  title="Télécharger en .md"
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
                >
                  <Download size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
