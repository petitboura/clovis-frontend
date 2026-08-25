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
  const [nomUpload, setNomUpload] = useState("");
  const [descriptionUpload, setDescriptionUpload] = useState("");
  const [envoiUpload, setEnvoiUpload] = useState(false);
  const [erreurUpload, setErreurUpload] = useState<string | null>(null);
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

  function choisirFichierUpload(f: File) {
    setFichierUpload(f);
    if (!nomUpload.trim()) setNomUpload(f.name.replace(/\.md$/i, ""));
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
          className="flex items-center justify-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3 text-sm font-semibold text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute"
        >
          <Plus size={16} /> Uploader un skill (.md)
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <input
            ref={inputFichierRef}
            type="file"
            accept=".md"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && choisirFichierUpload(e.target.files[0])}
          />
          <button
            onClick={() => inputFichierRef.current?.click()}
            className="flex items-center gap-2 rounded-cgpt-bouton border border-dashed border-dj-bordure px-4 py-3 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
          >
            <Upload size={15} />
            {fichierUpload ? fichierUpload.name : "Choisir un fichier .md..."}
          </button>
          <input
            value={nomUpload}
            onChange={(e) => setNomUpload(e.target.value)}
            placeholder="Nom du skill"
            className="rounded-cgpt-bouton border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <textarea
            value={descriptionUpload}
            onChange={(e) => setDescriptionUpload(e.target.value)}
            placeholder="Décris-le en quelques mots"
            rows={3}
            className="resize-none rounded-xl border border-dj-bordure bg-dj-fond px-4 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
          />
          <p className="text-xs text-dj-texte-muet">Publié immédiatement, visible par tout le monde.</p>
          {erreurUpload && <p className="text-xs text-[var(--dj-erreur)]">{erreurUpload}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setFormulaireOuvert(false);
                setFichierUpload(null);
              }}
              className="rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet hover:text-dj-texte"
            >
              Annuler
            </button>
            <button
              onClick={uploaderSkill}
              disabled={!fichierUpload || !nomUpload.trim() || envoiUpload}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {envoiUpload ? "Envoi…" : "Publier"}
            </button>
          </div>
        </div>
      )}

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {liste === undefined && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-16 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
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
