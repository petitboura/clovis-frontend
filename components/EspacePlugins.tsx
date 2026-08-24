"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Download, Trophy, Check, Users, FilePlus, X, BookOpen, FileText, PenSquare } from "lucide-react";
import { listerPlugins, telechargerPlugin, apercuPlugin, type Plugin, type ApercuPlugin } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { PanneauAjoutPluginPublic } from "./PanneauAjoutPluginPublic";
import { PanneauFlottant } from "./PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

// Lot 5 (chantier programme étudiant) -- interface de recherche/téléchar-
// gement des plugins (espaces de classe exportés en bloc, voir Partie 1 du
// document source). Ne gère PAS le paiement des plugins payants (hors
// scope du lancement) -- `gratuit` est affiché à titre indicatif seulement.
//
// 2026-08-14 : fusion demandée par Bourama -- plus de sections "Rechercher"
// / "Les plus téléchargés" séparées. Une seule liste, toujours triée par
// téléchargements décroissant (classement de la mécanique de lancement :
// le plus téléchargé fait gagner un an de gratuité à son auteur), avec un
// champ de recherche libre intégré (recherche en direct, débounce 300ms)
// qui filtre sur nom + niveau + auteur sans changer le tri.
//
// Pas de mécanisme i18n disponible dans ce composant (vérifié 2026-08-14,
// aucun i18n branché sur ce fichier ni sur le reste de l'espace plugins) --
// textes en dur en français comme le reste du fichier, à signaler à
// Bourama si la traduction doit être ajoutée plus tard.
//
// Pas encore de point d'entrée dans la navigation : composant autonome,
// à brancher par Bourama où il le souhaite (menu, onglet dédié…).

const DELAI_DEBOUNCE_MS = 300;

export function EspacePlugins() {
  const [motCle, setMotCle] = useState("");
  const [plugins, setPlugins] = useState<Plugin[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const requeteEnCours = useRef(0);

  useEffect(() => {
    const idAppel = ++requeteEnCours.current;
    setChargement(true);
    setErreur(null);

    const minuteur = setTimeout(async () => {
      try {
        const r = await listerPlugins(motCle);
        if (idAppel === requeteEnCours.current) {
          setPlugins(r);
        }
      } catch (e) {
        if (idAppel === requeteEnCours.current) {
          setErreur(messageErreur(e));
          setPlugins([]);
        }
      } finally {
        if (idAppel === requeteEnCours.current) {
          setChargement(false);
        }
      }
    }, motCle.trim() ? DELAI_DEBOUNCE_MS : 0);

    return () => clearTimeout(minuteur);
  }, [motCle]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dj-texte-muet"
        />
        <input
          value={motCle}
          onChange={(e) => setMotCle(e.target.value)}
          placeholder="Rechercher un plugin par nom, niveau ou créateur…"
          className="w-full rounded-cgpt-bouton border border-dj-bordure bg-dj-surface py-2.5 pl-10 pr-4 text-sm text-dj-texte outline-none transition-colors focus:border-dj-bordure-forte"
        />
      </div>

      <p className="text-xs text-dj-texte-muet">
        Le plugin le plus téléchargé fait gagner à son auteur un an de gratuité sur la version payante la moins
        chère.
      </p>

      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {chargement && (
        <div className="flex flex-col gap-2 transition-opacity duration-200" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "200ms" }} />
        </div>
      )}

      {!chargement && plugins?.length === 0 && !erreur && (
        <p className="text-sm text-dj-texte-muet">
          {motCle.trim() ? "Aucun plugin ne correspond à cette recherche." : "Aucun plugin publié pour l'instant."}
        </p>
      )}

      {!chargement && plugins && plugins.length > 0 && (
        <div className="flex flex-col gap-2 animate-dj-fade-in-rapide">
          {plugins.map((p, i) => (
            <LignePlugin key={p.id} plugin={p} rang={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function LignePlugin({ plugin, rang }: { plugin: Plugin; rang: number }) {
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [telecharge, setTelecharge] = useState(false);
  // Télécharger un plugin crée une copie dans "ton espace" -- lié à un
  // compte. La liste/recherche reste publique, seul ce clic est gaté
  // (refonte "Mon espace = l'app", même détection 401 que les autres
  // sections).
  const [sansCompte, setSansCompte] = useState(false);
  // Ajouter un document : action EN PLUS du téléchargement (inchangé,
  // toujours "ta propre copie"), disponible uniquement si ce plugin est
  // contribution_libre -- panneau replié par défaut (20/08).
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  // Aperçu (21/08, demande Bourama : "on ne peut pas le voir sans le
  // télécharger, la carte n'est pas cliquable") : clic sur la carte =
  // consultation en lecture seule (matières/chapitres + compteurs
  // documents/exercices), jamais un téléchargement -- endpoint public
  // GET /api/plugins/{id}/apercu, aucun compte requis pour juste voir.
  const [apercuOuvert, setApercuOuvert] = useState(false);
  const { enSortie: apercuEnSortie, demarrerFermeture: fermerApercuAnime } = useFermetureAnimee();
  const [apercu, setApercu] = useState<ApercuPlugin | null>(null);
  const [chargementApercu, setChargementApercu] = useState(false);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);

  async function ouvrirApercu() {
    setApercuOuvert(true);
    if (apercu) return; // déjà chargé, pas besoin de refaire l'appel
    setChargementApercu(true);
    setErreurApercu(null);
    try {
      setApercu(await apercuPlugin(plugin.id));
    } catch (e) {
      setErreurApercu(messageErreur(e));
    } finally {
      setChargementApercu(false);
    }
  }

  async function telecharger() {
    setEnvoi(true);
    setErreur(null);
    try {
      await telechargerPlugin(plugin.id);
      setTelecharge(true);
      setConfirmation(false);
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

  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={ouvrirApercu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && ouvrirApercu()}
        className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface px-4 py-3 transition-colors hover:border-dj-bordure-forte"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex w-6 flex-shrink-0 items-center justify-center text-sm font-bold text-dj-texte-muet">
            {rang === 0 ? <Trophy size={16} className="text-dj-texte-muet" /> : `#${rang + 1}`}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm text-dj-texte">{plugin.nom}</p>
              {plugin.contribution_libre && (
                <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-dj-surface-haute px-2 py-0.5 text-[10px] font-medium text-dj-texte-muet">
                  <Users size={10} /> Bibliothèque publique
                </span>
              )}
            </div>
            <p className="text-xs text-dj-texte-muet">
              {plugin.niveau} · {plugin.telechargements_count} téléchargement(s) · {plugin.gratuit ? "Gratuit" : "Payant"}
            </p>
            {erreur && <p className="mt-1 text-xs text-[var(--dj-erreur)]">{erreur}</p>}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {plugin.contribution_libre && (
            <button
              onClick={() => setPanneauOuvert((v) => !v)}
              className="flex items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
            >
              <FilePlus size={13} /> Ajouter un document
            </button>
          )}

          {sansCompte ? (
            <CTACompteRequis texte="Crée un compte pour télécharger ce plugin dans ton espace." />
          ) : telecharge ? (
            <span className="flex items-center gap-1.5 text-sm text-dj-succes">
              <Check size={14} /> Téléchargé
            </span>
          ) : confirmation ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-dj-texte-muet">Créer une copie dans ton espace ?</span>
              <button
                onClick={telecharger}
                disabled={envoi}
                className="rounded-cgpt-bouton bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                {envoi ? "…" : "Confirmer"}
              </button>
              <button
                onClick={() => setConfirmation(false)}
                disabled={envoi}
                className="text-xs text-dj-texte-muet hover:text-dj-texte"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmation(true)}
              className="flex items-center gap-1.5 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
            >
              <Download size={13} /> Télécharger
            </button>
          )}
        </div>
      </div>

      {panneauOuvert && (
        <PanneauAjoutPluginPublic
          programmeSourceId={plugin.programme_source_id}
          nomPlugin={plugin.nom}
          onFermer={() => setPanneauOuvert(false)}
        />
      )}

      {apercuOuvert && (
        <PanneauFlottant
          onFerme={() => fermerApercuAnime(() => setApercuOuvert(false))}
          enSortie={apercuEnSortie}
          entete={
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-dj-texte">{plugin.nom}</p>
                <p className="text-xs text-dj-texte-muet">
                  {plugin.niveau}
                  {apercu?.auteur_nom ? ` · par ${apercu.auteur_nom}` : ""}
                </p>
              </div>
              <button
                onClick={() => fermerApercuAnime(() => setApercuOuvert(false))}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          {chargementApercu && (
            <div className="flex flex-col gap-2" aria-hidden>
              <Skeleton className="h-12 rounded-xl border border-dj-bordure" />
              <Skeleton className="h-12 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
              <Skeleton className="h-12 rounded-xl border border-dj-bordure" style={{ animationDelay: "200ms" }} />
            </div>
          )}

          {erreurApercu && <p className="text-sm text-[var(--dj-erreur)]">{erreurApercu}</p>}

          {apercu && !chargementApercu && (
            <div className="flex flex-col gap-4">
              {apercu.matieres.length === 0 && (
                <p className="text-sm text-dj-texte-muet">Ce programme ne contient pas encore de matière.</p>
              )}
              {apercu.matieres.map((matiere) => (
                <div key={matiere.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="flex-shrink-0 text-dj-texte-muet" />
                    <h4 className="text-sm font-semibold text-dj-texte">{matiere.nom}</h4>
                  </div>
                  {matiere.chapitres.length === 0 ? (
                    <p className="pl-6 text-xs text-dj-texte-muet">Aucun chapitre pour l&apos;instant.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 pl-6">
                      {matiere.chapitres.map((chapitre) => (
                        <li
                          key={chapitre.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte"
                        >
                          <span className="truncate">{chapitre.nom}</span>
                          <span className="flex flex-shrink-0 items-center gap-3 text-xs text-dj-texte-muet">
                            <span className="flex items-center gap-1">
                              <FileText size={12} /> {chapitre.documents_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <PenSquare size={12} /> {chapitre.exercices_count}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    fermerApercuAnime(() => setApercuOuvert(false));
                    setConfirmation(true);
                  }}
                  className="flex items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
                >
                  <Download size={14} /> Télécharger ce plugin
                </button>
              </div>
            </div>
          )}
        </PanneauFlottant>
      )}
    </div>
  );
}
