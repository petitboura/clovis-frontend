"use client";

import { useEffect, useState } from "react";
import {
  diffuserDocumentMatiere,
  diffuserLienMatiere,
  listerMesContenus,
  type ContenuMatiere,
  type ResultatDiffusion,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { SelectPersonnalise } from "./SelectPersonnalise";

/**
 * "Diffuser" (réécrit le 09/08, demande Bourama : plus de "toute
 * l'équipe" indifférenciée -- on choisit une matière parmi celles qu'on
 * a écrites, et le document part UNIQUEMENT dans la bibliothèque
 * personnelle de ceux qui ont entré CE code précis, voir
 * api/contenu_dynamique_matiere.py:diffuser_document_matiere côté
 * backend, endpoint créé le 09/08).
 */
export function EspaceDiffuser() {
  const [contenus, setContenus] = useState<ContenuMatiere[]>([]);
  const [contenuId, setContenuId] = useState<string>("");
  const [chargementContenus, setChargementContenus] = useState(true);

  const [onglet, setOnglet] = useState<"document" | "lien">("document");

  const [fichier, setFichier] = useState<File | null>(null);
  const [descriptionFichier, setDescriptionFichier] = useState("");

  const [url, setUrl] = useState("");
  const [descriptionLien, setDescriptionLien] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatDiffusion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    listerMesContenus()
      .then((liste) => {
        setContenus(liste);
        if (liste.length > 0) setContenuId(liste[0].id);
      })
      .catch((e) => setErreur(messageErreur(e)))
      .finally(() => setChargementContenus(false));
  }, []);

  async function envoyer() {
    if (enCours || !contenuId) return;
    setErreur(null);
    setResultat(null);
    setEnCours(true);
    try {
      const r =
        onglet === "document"
          ? fichier && descriptionFichier.trim()
            ? await diffuserDocumentMatiere(contenuId, fichier, descriptionFichier.trim())
            : null
          : url.trim() && descriptionLien.trim()
            ? await diffuserLienMatiere(contenuId, url.trim(), descriptionLien.trim())
            : null;
      if (!r) return;
      setResultat(r);
      setFichier(null);
      setDescriptionFichier("");
      setUrl("");
      setDescriptionLien("");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const pretAEnvoyer =
    !!contenuId &&
    (onglet === "document" ? !!fichier && !!descriptionFichier.trim() : !!url.trim() && !!descriptionLien.trim());

  return (
    <section className="rounded-2xl border border-dj-bordure bg-dj-surface p-5">
      <h2 className="font-display text-base font-semibold text-dj-texte">Diffuser</h2>
      <p className="mt-1 text-xs text-dj-texte-muet">
        Ajouté à la bibliothèque personnelle de chacun de ceux qui ont entré ce code précis, privé à ce lien.
      </p>

      {chargementContenus && <Skeleton className="mt-4 h-10 rounded-xl border border-dj-bordure" />}

      {!chargementContenus && contenus.length === 0 && (
        <p className="mt-3 animate-dj-fade-in-rapide text-sm text-dj-texte-muet">
          Écris d'abord une matière pour pouvoir diffuser quelque chose.
        </p>
      )}

      {!chargementContenus && contenus.length > 0 && (
        <div className="mt-4 animate-dj-fade-in-rapide">
          <SelectPersonnalise
            valeur={contenuId}
            onChange={setContenuId}
            options={contenus.map((c) => ({ id: c.id, label: `${c.matiere} (${c.code})` }))}
          />

          <div className="mt-3 grid grid-cols-2 gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface-haute p-1">
            <button
              type="button"
              onClick={() => setOnglet("document")}
              className={`rounded-cgpt-bouton py-1.5 text-sm font-medium transition-colors ${
                onglet === "document" ? "bg-dj-accent-1 text-[#1A0D02]" : "text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              Document
            </button>
            <button
              type="button"
              onClick={() => setOnglet("lien")}
              className={`rounded-cgpt-bouton py-1.5 text-sm font-medium transition-colors ${
                onglet === "lien" ? "bg-dj-accent-1 text-[#1A0D02]" : "text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              Lien
            </button>
          </div>

          {onglet === "document" && (
            <div className="mt-4 animate-dj-fade-in-rapide">
              <input
                type="file"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-dj-texte-muet file:mr-3 file:rounded-cgpt-bouton file:border-0 file:bg-dj-surface-haute file:px-3 file:py-1.5 file:text-xs file:text-dj-texte"
              />
              <input
                value={descriptionFichier}
                onChange={(e) => setDescriptionFichier(e.target.value)}
                placeholder="Description (pour que Clovis sache le retrouver)"
                className="mt-2 w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>
          )}

          {onglet === "lien" && (
            <div className="mt-4 animate-dj-fade-in-rapide">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
              <input
                value={descriptionLien}
                onChange={(e) => setDescriptionLien(e.target.value)}
                placeholder="Description (pour que Clovis sache le retrouver)"
                className="mt-2 w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>
          )}

          {erreur && <p className="mt-2 animate-dj-fade-in-rapide text-sm text-[var(--dj-erreur)]">{erreur}</p>}
          {resultat && (
            <p className="mt-2 animate-dj-fade-in-rapide text-sm text-dj-succes">
              Diffusé à {resultat.diffuse_a}/{resultat.total_receveurs} personnes.
              {resultat.echecs.length > 0 && <> Échec pour {resultat.echecs.length} d'entre elles.</>}
            </p>
          )}

          <button
            onClick={envoyer}
            disabled={!pretAEnvoyer || enCours}
            className="mt-3 rounded-cgpt-bouton bg-dj-accent-1 px-4 py-1.5 text-sm font-bold text-[#1A0D02] transition-opacity disabled:opacity-50"
          >
            {enCours ? "Diffusion…" : "Diffuser"}
          </button>
        </div>
      )}
    </section>
  );
}
