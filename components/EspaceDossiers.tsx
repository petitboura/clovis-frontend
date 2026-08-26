"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Folder as IconDossier,
  FolderPlus,
  FolderX,
  FilePlus,
  File as IconFichier,
  MoreVertical,
  Pencil,
  Trash2,
  Move,
  ChevronRight,
  ChevronLeft,
  Smartphone,
} from "lucide-react";
import { usePluginNatif, messageErreurPlugin } from "@/lib/usePluginNatif";
import { Skeleton } from "./Skeleton";
import { PanneauFlottant } from "./PanneauFlottant";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";

/**
 * Écran autonome pour le plugin natif Dossiers (Lot 3B Partie 3 mobile,
 * 25/08/2026 -- voir android/.../dossiers/DossiersPlugin.kt, porté depuis
 * clovis-mobile/android-legacy-natif Lot 2 : SAF -- Storage Access
 * Framework, accès par URI, pas de chemin de fichier classique).
 *
 * Construit le 26/08/2026 à la demande de Bourama : composant fonctionnel
 * autonome, pas de route Next.js dédiée, pas de décision sur l'emplacement
 * dans la navigation (fusion avec Bibliothèque décidée par Bourama, mais
 * l'intégration concrète est un autre chantier).
 *
 * Pas de mécanisme i18n branché (voir EspaceParametres.tsx) -- textes en
 * dur en français.
 */

type DossierDesigne = { uri: string; nom: string };
type ElementDossier = { uri: string; nom: string; estDossier: boolean; tailleOctets: number };

type PluginDossiers = {
  listerDossiersDesignes(): Promise<{ dossiers: DossierDesigne[] }>;
  choisirDossier(): Promise<DossierDesigne>;
  retirerDossierDesigne(options: { uri: string }): Promise<void>;
  listerContenu(options: { uri: string }): Promise<{ elements: ElementDossier[] }>;
  creerSousDossier(options: { parentUri: string; nom: string }): Promise<void>;
  creerFichier(options: { parentUri: string; nom: string; typeMime?: string }): Promise<void>;
  renommer(options: { elementUri: string; nouveauNom: string }): Promise<void>;
  supprimer(options: { elementUri: string }): Promise<void>;
  deplacer(options: { elementUri: string; ancienParentUri: string; nouveauParentUri: string }): Promise<void>;
};

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function EspaceDossiers() {
  const { natif, plugin } = usePluginNatif<PluginDossiers>("Dossiers");
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  // Pile de navigation : vide = racine (liste des dossiers désignés).
  const [pile, setPile] = useState<{ uri: string; nom: string }[]>([]);
  const [dossiersDesignes, setDossiersDesignes] = useState<DossierDesigne[] | null>(null);
  const [elements, setElements] = useState<ElementDossier[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<null | "sous-dossier" | "fichier" | "renommer">(null);
  const [elementCible, setElementCible] = useState<ElementDossier | null>(null);
  const [valeurSaisie, setValeurSaisie] = useState("");
  const [dialoguePicker, setDialoguePicker] = useState<ElementDossier | null>(null);
  const [action, setAction] = useState(false);

  const dossierCourant = pile[pile.length - 1] ?? null;

  const rafraichir = useCallback(() => {
    if (!plugin) return;
    setChargement(true);
    setErreur(null);
    if (!dossierCourant) {
      plugin
        .listerDossiersDesignes()
        .then((r) => setDossiersDesignes(r.dossiers))
        .catch((e) => setErreur(messageErreurPlugin(e)))
        .finally(() => setChargement(false));
    } else {
      plugin
        .listerContenu({ uri: dossierCourant.uri })
        .then((r) => setElements(r.elements))
        .catch((e) => setErreur(messageErreurPlugin(e)))
        .finally(() => setChargement(false));
    }
  }, [plugin, dossierCourant]);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  async function ajouterDossier() {
    if (!plugin) return;
    setErreur(null);
    try {
      await plugin.choisirDossier();
      rafraichir();
    } catch (e) {
      // L'utilisateur peut simplement avoir annulé le sélecteur système --
      // pas la peine d'afficher ça comme une vraie erreur bloquante.
    }
  }

  async function retirerDossier(uri: string) {
    if (!plugin) return;
    setAction(true);
    try {
      await plugin.retirerDossierDesigne({ uri });
      rafraichir();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
      setMenuOuvert(null);
    }
  }

  function fermerDialogue() {
    demarrerFermeture(() => {
      setDialogue(null);
      setElementCible(null);
      setValeurSaisie("");
    });
  }

  async function validerDialogue() {
    if (!plugin || !dossierCourant || !valeurSaisie.trim()) return;
    setAction(true);
    setErreur(null);
    try {
      if (dialogue === "sous-dossier") {
        await plugin.creerSousDossier({ parentUri: dossierCourant.uri, nom: valeurSaisie.trim() });
      } else if (dialogue === "fichier") {
        await plugin.creerFichier({ parentUri: dossierCourant.uri, nom: valeurSaisie.trim() });
      } else if (dialogue === "renommer" && elementCible) {
        await plugin.renommer({ elementUri: elementCible.uri, nouveauNom: valeurSaisie.trim() });
      }
      fermerDialogue();
      rafraichir();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  async function supprimerElement(el: ElementDossier) {
    if (!plugin) return;
    setAction(true);
    try {
      await plugin.supprimer({ elementUri: el.uri });
      rafraichir();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
      setMenuOuvert(null);
    }
  }

  async function deplacerVers(cibleDossier: { uri: string }) {
    if (!plugin || !dialoguePicker || !dossierCourant) return;
    setAction(true);
    setErreur(null);
    try {
      await plugin.deplacer({
        elementUri: dialoguePicker.uri,
        ancienParentUri: dossierCourant.uri,
        nouveauParentUri: cibleDossier.uri,
      });
      setDialoguePicker(null);
      rafraichir();
    } catch (e) {
      setErreur(messageErreurPlugin(e));
    } finally {
      setAction(false);
    }
  }

  if (natif === null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-12 rounded-cgpt-carte" />
        <Skeleton className="h-12 rounded-cgpt-carte" />
      </div>
    );
  }

  if (!natif) {
    return (
      <div className="flex animate-dj-fade-in-rapide flex-col items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-6 text-center">
        <Smartphone size={22} className="text-dj-texte-muet" />
        <p className="text-sm text-dj-texte-muet">Dossiers du téléphone est disponible uniquement depuis l&apos;app mobile.</p>
      </div>
    );
  }

  return (
    <div className="flex animate-dj-fade-in-rapide flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1 text-sm text-dj-texte-muet">
          {pile.length > 0 && (
            <button
              onClick={() => setPile((p) => p.slice(0, -1))}
              aria-label="Retour"
              className="flex-shrink-0 rounded-lg p-1 transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="truncate font-medium text-dj-texte">
            {dossierCourant ? dossierCourant.nom : "Dossiers du téléphone"}
          </span>
        </div>
        {!dossierCourant ? (
          <button
            onClick={ajouterDossier}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
          >
            <FolderPlus size={14} />
            Ajouter
          </button>
        ) : (
          <div className="flex flex-shrink-0 gap-2">
            <button
              onClick={() => {
                setDialogue("sous-dossier");
                setValeurSaisie("");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-dj-surface-haute px-3 py-1.5 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-bordure"
            >
              <FolderPlus size={14} />
              Sous-dossier
            </button>
            <button
              onClick={() => {
                setDialogue("fichier");
                setValeurSaisie("");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-dj-surface-haute px-3 py-1.5 text-xs font-bold text-dj-texte transition-colors hover:bg-dj-bordure"
            >
              <FilePlus size={14} />
              Fichier
            </button>
          </div>
        )}
      </div>

      {chargement ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 rounded-cgpt-carte" />
          <Skeleton className="h-12 rounded-cgpt-carte" />
        </div>
      ) : !dossierCourant ? (
        (dossiersDesignes ?? []).length === 0 ? (
          <p className="p-2 text-sm text-dj-texte-muet">Aucun dossier désigné pour l&apos;instant.</p>
        ) : (
          <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            <div className="divide-y divide-dj-bordure">
              {(dossiersDesignes ?? []).map((d) => (
                <div key={d.uri} className="flex items-center gap-2 px-4 py-3">
                  <button
                    onClick={() => setPile([{ uri: d.uri, nom: d.nom }])}
                    className="flex flex-1 items-center gap-3 overflow-hidden text-left"
                  >
                    <IconDossier size={18} className="flex-shrink-0 text-dj-texte-muet" />
                    <span className="truncate text-sm text-dj-texte">{d.nom}</span>
                  </button>
                  <button
                    onClick={() => retirerDossier(d.uri)}
                    disabled={action}
                    aria-label="Retirer ce dossier"
                    className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-[var(--dj-erreur)] disabled:opacity-50"
                  >
                    <FolderX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (elements ?? []).length === 0 ? (
        <p className="p-2 text-sm text-dj-texte-muet">Ce dossier est vide.</p>
      ) : (
        <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <div className="divide-y divide-dj-bordure">
            {(elements ?? []).map((el) => (
              <div key={el.uri} className="relative flex items-center gap-2 px-4 py-3">
                <button
                  onClick={() => el.estDossier && setPile((p) => [...p, { uri: el.uri, nom: el.nom }])}
                  className="flex flex-1 items-center gap-3 overflow-hidden text-left"
                >
                  {el.estDossier ? (
                    <IconDossier size={18} className="flex-shrink-0 text-dj-texte-muet" />
                  ) : (
                    <IconFichier size={18} className="flex-shrink-0 text-dj-texte-muet" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-dj-texte">{el.nom}</span>
                    {!el.estDossier && (
                      <span className="text-xs text-dj-texte-muet">{formaterTaille(el.tailleOctets)}</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setMenuOuvert(menuOuvert === el.uri ? null : el.uri)}
                  aria-label="Options"
                  className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
                >
                  <MoreVertical size={16} />
                </button>
                {menuOuvert === el.uri && (
                  <div className="absolute right-4 top-11 z-10 w-40 overflow-hidden rounded-lg border border-dj-bordure bg-dj-surface shadow-lg">
                    <button
                      onClick={() => {
                        setElementCible(el);
                        setValeurSaisie(el.nom);
                        setDialogue("renommer");
                        setMenuOuvert(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dj-texte hover:bg-dj-surface-haute"
                    >
                      <Pencil size={14} />
                      Renommer
                    </button>
                    <button
                      onClick={() => {
                        setDialoguePicker(el);
                        setMenuOuvert(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-dj-texte hover:bg-dj-surface-haute"
                    >
                      <Move size={14} />
                      Déplacer
                    </button>
                    <button
                      onClick={() => supprimerElement(el)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dj-erreur)] hover:bg-dj-surface-haute"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {erreur && <span className="text-sm text-[var(--dj-erreur)]">{erreur}</span>}

      {dialogue && (
        <PanneauFlottant
          enSortie={enSortie}
          onFerme={fermerDialogue}
          entete={
            <h3 className="text-sm font-bold text-dj-texte">
              {dialogue === "sous-dossier" ? "Nouveau sous-dossier" : dialogue === "fichier" ? "Nouveau fichier" : "Renommer"}
            </h3>
          }
        >
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              value={valeurSaisie}
              onChange={(e) => setValeurSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validerDialogue()}
              placeholder="Nom"
              className="rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-accent-1"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={fermerDialogue}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
              >
                Annuler
              </button>
              <button
                onClick={validerDialogue}
                disabled={action || !valeurSaisie.trim()}
                className="rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                Valider
              </button>
            </div>
          </div>
        </PanneauFlottant>
      )}

      {dialoguePicker && (
        <PickerDeplacement
          plugin={plugin}
          exclureUri={dialoguePicker.uri}
          onChoisir={deplacerVers}
          onFerme={() => setDialoguePicker(null)}
        />
      )}
    </div>
  );
}

/** Petit sélecteur de dossier de destination pour "Déplacer" -- navigue dans
 * les mêmes dossiers désignés, ne propose que des dossiers (pas les
 * fichiers) comme destination. */
function PickerDeplacement({
  plugin,
  exclureUri,
  onChoisir,
  onFerme,
}: {
  plugin: PluginDossiers | null;
  exclureUri: string;
  onChoisir: (cible: { uri: string; nom: string }) => void;
  onFerme: () => void;
}) {
  const { enSortie, demarrerFermeture } = useFermetureAnimee();
  const [pile, setPile] = useState<{ uri: string; nom: string }[]>([]);
  const [items, setItems] = useState<{ uri: string; nom: string }[] | null>(null);
  const [chargement, setChargement] = useState(true);

  const courant = pile[pile.length - 1] ?? null;

  useEffect(() => {
    if (!plugin) return;
    setChargement(true);
    const requete = courant ? plugin.listerContenu({ uri: courant.uri }) : plugin.listerDossiersDesignes();
    requete
      .then((r) => {
        const liste = "dossiers" in r ? r.dossiers : r.elements.filter((e) => e.estDossier);
        setItems(liste.filter((d) => d.uri !== exclureUri));
      })
      .finally(() => setChargement(false));
  }, [plugin, courant, exclureUri]);

  return (
    <PanneauFlottant enSortie={enSortie} onFerme={() => demarrerFermeture(onFerme)} entete={<h3 className="text-sm font-bold text-dj-texte">Déplacer vers…</h3>}>
      <div className="flex flex-col gap-2">
        {courant && (
          <button
            onClick={() => setPile((p) => p.slice(0, -1))}
            className="flex w-fit items-center gap-1 text-xs text-dj-texte-muet hover:text-dj-texte"
          >
            <ChevronLeft size={14} />
            Retour
          </button>
        )}
        {chargement ? (
          <Skeleton className="h-24 rounded-cgpt-carte" />
        ) : (items ?? []).length === 0 ? (
          <p className="text-sm text-dj-texte-muet">Aucun sous-dossier ici.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {(items ?? []).map((d) => (
              <div key={d.uri} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-dj-surface-haute">
                <button
                  onClick={() => setPile((p) => [...p, d])}
                  className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                >
                  <IconDossier size={16} className="flex-shrink-0 text-dj-texte-muet" />
                  <span className="truncate text-sm text-dj-texte">{d.nom}</span>
                  <ChevronRight size={14} className="ml-auto flex-shrink-0 text-dj-texte-muet" />
                </button>
              </div>
            ))}
          </div>
        )}
        {courant && (
          <button
            onClick={() => onChoisir(courant)}
            className="mt-2 self-end rounded-lg bg-dj-accent-1 px-3 py-1.5 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2"
          >
            Déplacer ici
          </button>
        )}
      </div>
    </PanneauFlottant>
  );
}
