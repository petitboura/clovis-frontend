"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, X, ScrollText, Folder, StickyNote, Pencil } from "lucide-react";
import {
  listerMesCodes,
  creerCode,
  modifierCode,
  activerCode,
  supprimerCode,
  lireMesComportements,
  listerDossiersBibliotheque,
  creerDossierBibliotheque,
  type CodePartage,
  type Comportement,
  type DossierBibliotheque,
} from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { PanneauFlottant } from "./PanneauFlottant";
import { EditeurComportement } from "./EditeurComportement";
import { EspaceBibliotheque } from "./EspaceBibliotheque";

// Même agent générique que MesComportements.tsx (app/(app)/comportements/page.tsx)
// -- "Mes comportements" n'a jamais eu de notion de rôle, un seul agentId
// pour tout le monde.
const AGENT_ID = "clovis";

/**
 * "Mes codes" (14/08/2026, demande Bourama -- remplace EspaceInviter /
 * EspaceEquipe / EspaceDiffuser dans l'onglet Bureau, qui géraient
 * l'ancien système "un code = une matière", jamais lu par le chat).
 *
 * Plusieurs codes possibles, pour ne pas mélanger "à qui j'envoie quoi"
 * -- chaque code peut porter, tous optionnels et combinables : une
 * sélection de comportements déjà créés dans "Mes comportements"
 * (18/08/2026, demande Bourama : plus de texte tapé ici, référence
 * vivante -- voir ChampComportement), un ou plusieurs dossiers de
 * bibliothèque déjà créés (02/09/2026, demande Bourama : remplace
 * l'ancien "Partager ma bibliothèque" tout ou rien -- voir
 * ChampDossiers, chaque dossier partagé synchronise son contenu actuel
 * ET tous ses ajouts futurs, sous-dossiers compris), un texte libre.
 * Vivant : modifier un champ met à jour ce que voient tous les
 * receveurs de ce code, pas besoin d'en générer un nouveau.
 */
export function MesCodes() {
  const [codes, setCodes] = useState<CodePartage[] | undefined>(undefined);
  const [mesComportements, setMesComportements] = useState<Comportement[]>([]);
  const [mesDossiers, setMesDossiers] = useState<DossierBibliotheque[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null); // id du code en édition
  const [creation, setCreation] = useState(false);
  const [copieOk, setCopieOk] = useState<string | null>(null);
  // Refonte "Mon espace = l'app" : section auparavant inatteignable sans
  // compte, même détection 401 que les autres.
  const [sansCompte, setSansCompte] = useState(false);

  // 12/09/2026, chantier "Mes codes = un vrai éditeur" (demande Bourama) :
  // ouvrir un skill (existant OU en création) directement depuis "Mes
  // codes", sans repasser par "Mes comportements". `codeId` = le code
  // depuis lequel l'éditeur a été ouvert (utilisé pour l'attache
  // automatique à la création, voir onCree plus bas) -- reste utile même
  // pour un skill ouvert en lecture/édition simple, non attaché à ce code.
  const [editeurComportement, setEditeurComportement] = useState<{ id: string | null; codeId: string } | null>(null);
  const { enSortie: editeurEnSortie, demarrerFermeture: fermerEditeurAnime } = useFermetureAnimee();

  // Même principe pour les dossiers, mais la Bibliothèque elle-même gère
  // sa création/son contenu -- pas de onCree/onModifie/onSupprime à
  // câbler ici, juste l'ouvrir scopée sur le bon dossier (voir
  // EspaceBibliotheque.tsx, prop dossierInitialId) et resynchroniser la
  // liste des codes/dossiers à la fermeture (l'attache a pu changer
  // depuis l'onglet "Codes" intégré à la Bibliothèque).
  const [dossierOuvert, setDossierOuvert] = useState<string | null>(null);
  const { enSortie: dossierEnSortie, demarrerFermeture: fermerDossierAnime } = useFermetureAnimee();

  // Vue divisée sur desktop (code à gauche, éditeur à droite), panneau
  // plein écran par-dessus sur mobile -- même convention que ChatFlottant.tsx
  // (window.matchMedia au montage, pas au rendu serveur).
  const [estDesktop, setEstDesktop] = useState(false);
  useEffect(() => {
    setEstDesktop(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  function chargerDossiers() {
    listerDossiersBibliotheque().then(setMesDossiers).catch(() => setMesDossiers([]));
  }

  function chargerComportements() {
    lireMesComportements(AGENT_ID).then(setMesComportements).catch(() => setMesComportements([]));
  }

  function charger() {
    listerMesCodes()
      .then(setCodes)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreur(messageErreur(e));
        }
      });
  }

  useEffect(() => {
    charger();
    chargerComportements();
    chargerDossiers();
  }, []);

  function ouvrirEditeurComportement(codeId: string, id: string | null) {
    setEditeurComportement({ id, codeId });
  }

  // Fermeture animée + resynchronisation : le panneau permet d'attacher/
  // détacher ce skill à n'importe quel code depuis son propre onglet
  // "Codes" (pas seulement au code d'où il a été ouvert), donc on
  // recharge la liste des codes à la fermeture plutôt que de patcher
  // localement un seul code.
  function fermerEditeurComportement() {
    setEditeurComportement(null);
    charger();
    chargerComportements();
  }

  function fermerDossierOuvert() {
    setDossierOuvert(null);
    charger();
    chargerDossiers();
  }

  async function creerVide() {
    setErreur(null);
    try {
      const c = await creerCode({});
      setCodes((prec) => [...(prec || []), c]);
      setOuvert(c.id);
      setCreation(false);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function sauvegarder(codeId: string, patch: Parameters<typeof modifierCode>[1]) {
    setErreur(null);
    try {
      const maj = await modifierCode(codeId, patch);
      setCodes((prec) => (prec || []).map((c) => (c.id === codeId ? maj : c)));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function toggleActif(c: CodePartage) {
    setErreur(null);
    try {
      const maj = await activerCode(c.id, !c.actif);
      setCodes((prec) => (prec || []).map((x) => (x.id === c.id ? maj : x)));
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  async function supprimer(codeId: string) {
    setErreur(null);
    try {
      await supprimerCode(codeId);
      setCodes((prec) => (prec || []).filter((c) => c.id !== codeId));
      if (ouvert === codeId) setOuvert(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  function copier(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopieOk(code);
      setTimeout(() => setCopieOk(null), 1500);
    });
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour créer des codes de partage." />;
  }

  if (codes === undefined) {
    return (
      <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5" aria-hidden>
        {/* Skeleton précis (30/08, audit) : en-tête (titre + description
            2 lignes + bouton "Nouveau code") distinct de la liste des
            codes en dessous (pastille de statut + nom + badge code +
            chevron), au lieu d'un titre suivi d'un seul bloc plein qui ne
            représentait ni l'un ni l'autre. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-3 w-full rounded" style={{ animationDelay: "80ms" }} />
            <Skeleton className="h-3 w-4/5 rounded" style={{ animationDelay: "160ms" }} />
          </div>
          <Skeleton className="h-8 w-32 flex-shrink-0 rounded-cgpt-bouton" style={{ animationDelay: "240ms" }} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {[
            { largeur: "w-1/3", delai: "0ms" },
            { largeur: "w-1/2", delai: "80ms" },
            { largeur: "w-2/5", delai: "160ms" },
            { largeur: "w-1/4", delai: "240ms" },
          ].map(({ largeur, delai }, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-xl border border-dj-bordure bg-dj-surface-haute px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ animationDelay: delai }} />
                <Skeleton className={`h-3.5 rounded ${largeur}`} style={{ animationDelay: delai }} />
                <Skeleton className="h-4 w-14 flex-shrink-0 rounded-md" style={{ animationDelay: delai }} />
              </div>
              <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const contenuPrincipal = (
    <section className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-base font-semibold text-dj-texte">Mes codes</h2>
            <BoutonInfoSection
              rubriqueId="mes-codes"
              texteCourt="Crée un code et partage-le : tous ceux qui l'entrent reçoivent ce que tu y mets."
            />
          </div>
        </div>
        <button
          onClick={creerVide}
          disabled={creation}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-cgpt-bouton bg-dj-accent-1 px-3 py-2 text-xs font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
        >
          <Plus size={14} /> Nouveau code
        </button>
      </div>

      {erreur && <p className="mt-3 text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      <div className="mt-4 space-y-2">
        {codes.length === 0 && (
          <p className="rounded-xl border border-dashed border-dj-bordure px-3 py-4 text-center text-xs text-dj-texte-muet">
            Aucun code pour l&apos;instant. Crée-en un pour partager quelque chose.
          </p>
        )}

        {codes.map((c) => (
          <CarteCode
            key={c.id}
            c={c}
            estOuvert={ouvert === c.id}
            onToggleOuvert={() => setOuvert(ouvert === c.id ? null : c.id)}
            copieOk={copieOk === c.code}
            onCopier={() => copier(c.code)}
            onToggleActif={() => toggleActif(c)}
            onSupprimer={() => supprimer(c.id)}
            onSauverNom={(nom) => sauvegarder(c.id, { nom })}
            onSauverTexte={(texte_libre) => sauvegarder(c.id, { texte_libre })}
            onSauverComportements={(comportement_ids) => sauvegarder(c.id, { comportement_ids })}
            onSauverDossiers={(dossier_ids) => sauvegarder(c.id, { dossier_ids })}
            mesComportements={mesComportements}
            mesDossiers={mesDossiers}
            onDossierCree={chargerDossiers}
            onOuvrirComportement={(id) => ouvrirEditeurComportement(c.id, id)}
            onOuvrirDossier={setDossierOuvert}
          />
        ))}
      </div>
    </section>
  );

  // Skill ouvert (id fourni) ou en création (id === null) depuis "Mes
  // codes" -- même composant que "Mes comportements", voir
  // EditeurComportement.tsx. L'onglet "Codes" à l'intérieur permet
  // d'attacher/détacher ce skill à N'IMPORTE quel code, pas seulement
  // celui d'où l'éditeur a été ouvert -- d'où le rechargement complet
  // (charger + chargerComportements) à la fermeture plutôt qu'un patch
  // local ciblé sur un seul code.
  const editeurJsx = editeurComportement && (
    <EditeurComportement
      agentId={AGENT_ID}
      comportement={editeurComportement.id ? mesComportements.find((cm) => cm.id === editeurComportement.id) || null : null}
      onFermer={() => fermerEditeurAnime(fermerEditeurComportement)}
      onCree={(nouveau) => {
        setMesComportements((prev) => [...prev, nouveau]);
        const codeCourant = codes?.find((x) => x.id === editeurComportement.codeId);
        const idsActuels = codeCourant ? codeCourant.comportements.map((cm) => cm.id) : [];
        sauvegarder(editeurComportement.codeId, { comportement_ids: [...idsActuels, nouveau.id] });
      }}
      onModifie={(maj) => setMesComportements((prev) => prev.map((x) => (x.id === maj.id ? maj : x)))}
      onSupprime={(id) => setMesComportements((prev) => prev.filter((x) => x.id !== id))}
    />
  );

  // Dossier ouvert depuis "Mes codes" -- monte la vraie Bibliothèque
  // (EspaceBibliotheque.tsx), scopée sur ce dossier via dossierInitialId,
  // habillée d'un petit en-tête "Fermer" (ce composant n'en a pas nativement,
  // normalement toute une page/onglet, jamais embarqué ailleurs jusqu'ici).
  const dossierJsx = dossierOuvert && (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-end">
        <button
          onClick={() => fermerDossierAnime(fermerDossierOuvert)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute"
        >
          <X size={14} /> Fermer
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EspaceBibliotheque dossierInitialId={dossierOuvert} />
      </div>
    </div>
  );

  const unEditeurOuvert = !!editeurComportement || !!dossierOuvert;

  return (
    <div className={unEditeurOuvert && estDesktop ? "flex items-start gap-4" : undefined}>
      <div className={unEditeurOuvert && estDesktop ? "min-w-0 flex-1" : undefined}>{contenuPrincipal}</div>

      {editeurComportement && estDesktop && (
        <div className="sticky top-4 max-h-[85vh] w-full max-w-md flex-shrink-0 overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
          {editeurJsx}
        </div>
      )}
      {editeurComportement && !estDesktop && (
        <PanneauFlottant large enSortie={editeurEnSortie} onFerme={() => fermerEditeurAnime(fermerEditeurComportement)}>
          {editeurJsx}
        </PanneauFlottant>
      )}

      {dossierOuvert && estDesktop && (
        <div className="sticky top-4 max-h-[85vh] w-full max-w-xl flex-shrink-0 overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-5">
          {dossierJsx}
        </div>
      )}
      {dossierOuvert && !estDesktop && (
        <PanneauFlottant large enSortie={dossierEnSortie} onFerme={() => fermerDossierAnime(fermerDossierOuvert)}>
          {dossierJsx}
        </PanneauFlottant>
      )}
    </div>
  );
}

/**
 * 12/09/2026, chantier "Mes codes = un vrai éditeur" -- Bourama : "elle
 * ressemble toujours à un formulaire". Refonte : plus de sections
 * labellisées empilées (Nom / Skills / Dossiers / Texte libre), tout ce
 * qui est attaché à un code se lit comme un ensemble de puces cliquables
 * (skill, dossier, note), pas des champs de formulaire à remplir. Le nom
 * se modifie en place dans l'en-tête (clic sur le crayon), pas dans un
 * champ séparé plus bas.
 */
function CarteCode({
  c,
  estOuvert,
  onToggleOuvert,
  copieOk,
  onCopier,
  onToggleActif,
  onSupprimer,
  onSauverNom,
  onSauverTexte,
  onSauverComportements,
  onSauverDossiers,
  mesComportements,
  mesDossiers,
  onDossierCree,
  onOuvrirComportement,
  onOuvrirDossier,
}: {
  c: CodePartage;
  estOuvert: boolean;
  onToggleOuvert: () => void;
  copieOk: boolean;
  onCopier: () => void;
  onToggleActif: () => void;
  onSupprimer: () => void;
  onSauverNom: (v: string) => void;
  onSauverTexte: (v: string) => void;
  onSauverComportements: (ids: string[]) => void;
  onSauverDossiers: (ids: string[]) => void;
  mesComportements: Comportement[];
  mesDossiers: DossierBibliotheque[];
  onDossierCree: () => void;
  onOuvrirComportement: (id: string | null) => void;
  onOuvrirDossier: (id: string) => void;
}) {
  const [renommage, setRenommage] = useState(false);
  const [nomEnCours, setNomEnCours] = useState(c.nom || "");
  const [editionNote, setEditionNote] = useState(false);
  const [noteEnCours, setNoteEnCours] = useState(c.texte_libre || "");

  function validerNom() {
    setRenommage(false);
    const propre = nomEnCours.trim();
    if (propre !== (c.nom || "")) onSauverNom(propre);
  }

  function validerNote() {
    setEditionNote(false);
    if (noteEnCours !== (c.texte_libre || "")) onSauverTexte(noteEnCours);
  }

  function attacherComportement(id: string) {
    onSauverComportements([...c.comportements.map((x) => x.id), id]);
  }
  function detacherComportement(id: string) {
    onSauverComportements(c.comportements.filter((x) => x.id !== id).map((x) => x.id));
  }
  function attacherDossier(id: string) {
    onSauverDossiers([...c.dossiers.map((x) => x.id), id]);
  }
  function detacherDossier(id: string) {
    onSauverDossiers(c.dossiers.filter((x) => x.id !== id).map((x) => x.id));
  }

  return (
    <div className="rounded-xl border border-dj-bordure bg-dj-surface-haute">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          onClick={onToggleOuvert}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggleOuvert()}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={"h-1.5 w-1.5 flex-shrink-0 rounded-full " + (c.actif ? "bg-dj-accent-1" : "bg-dj-texte-muet")} />
          {renommage ? (
            <input
              autoFocus
              value={nomEnCours}
              onChange={(e) => setNomEnCours(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") validerNom();
              }}
              onBlur={validerNom}
              placeholder="Nom pour toi (pas pour les receveurs)"
              className="min-w-0 flex-1 rounded-md border border-dj-bordure-forte bg-dj-surface px-1.5 py-0.5 text-sm text-dj-texte outline-none"
            />
          ) : (
            <span className="truncate text-sm text-dj-texte">{c.nom || "Sans nom"}</span>
          )}
          <span className="flex-shrink-0 rounded-full border border-dj-bordure bg-dj-fond px-2.5 py-1 font-mono text-[11px] tracking-[0.15em] text-dj-texte-muet">
            {c.code}
          </span>
        </div>

        {!renommage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNomEnCours(c.nom || "");
              setRenommage(true);
            }}
            title="Renommer"
            className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte"
          >
            <Pencil size={13} />
          </button>
        )}
        <button
          onClick={onToggleOuvert}
          className="flex-shrink-0 rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:text-dj-texte"
        >
          {estOuvert ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {estOuvert && (
        <div className="animate-dj-fade-in-rapide space-y-3 border-t border-dj-bordure px-3 py-3">
          <div className="flex items-center gap-1 text-dj-texte-muet">
            <button
              onClick={onCopier}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-dj-surface hover:text-dj-texte"
            >
              <Copy size={12} /> {copieOk ? "Copié !" : "Copier le code"}
            </button>
            <button
              onClick={onToggleActif}
              className={
                "ml-auto rounded-lg px-2 py-1 text-xs font-semibold transition-colors " +
                (c.actif ? "hover:bg-dj-surface hover:text-dj-texte" : "text-dj-accent-1-texte")
              }
            >
              {c.actif ? "Désactiver" : "Réactiver"}
            </button>
            <button
              onClick={onSupprimer}
              title="Supprimer ce code"
              className="rounded-lg p-1.5 transition-colors hover:text-[var(--dj-erreur)]"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {c.comportements.map((cm) => (
              <div
                key={cm.id}
                className="group/puce flex items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface py-1.5 pl-3 pr-2 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
              >
                <ScrollText size={11} className="flex-shrink-0 text-dj-texte-muet" />
                <button type="button" onClick={() => onOuvrirComportement(cm.id)} className="max-w-[9rem] truncate text-left">
                  {cm.nom}
                </button>
                <button
                  type="button"
                  onClick={() => detacherComportement(cm.id)}
                  title="Détacher"
                  className="flex-shrink-0 rounded-full p-0.5 text-dj-texte-muet opacity-0 transition-opacity hover:text-[var(--dj-erreur)] group-hover/puce:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}

            {c.dossiers.map((d) => (
              <div
                key={d.id}
                className="group/puce flex items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface py-1.5 pl-3 pr-2 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte"
              >
                <Folder size={11} className="flex-shrink-0 text-dj-texte-muet" />
                <button type="button" onClick={() => onOuvrirDossier(d.id)} className="max-w-[9rem] truncate text-left">
                  {d.nom}
                </button>
                <button
                  type="button"
                  onClick={() => detacherDossier(d.id)}
                  title="Détacher"
                  className="flex-shrink-0 rounded-full p-0.5 text-dj-texte-muet opacity-0 transition-opacity hover:text-[var(--dj-erreur)] group-hover/puce:opacity-100"
                >
                  <X size={11} />
                </button>
              </div>
            ))}

            {!editionNote && !c.texte_libre && (
              <button
                onClick={() => setEditionNote(true)}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
              >
                <StickyNote size={12} /> Note
              </button>
            )}

            <AjoutContenuPopover
              mesComportements={mesComportements}
              mesDossiers={mesDossiers}
              idsComportementsActuels={c.comportements.map((x) => x.id)}
              idsDossiersActuels={c.dossiers.map((x) => x.id)}
              onAttacherComportement={attacherComportement}
              onAttacherDossier={attacherDossier}
              onOuvrirNouveauComportement={() => onOuvrirComportement(null)}
              onDossierCree={onDossierCree}
            />
          </div>

          {(editionNote || c.texte_libre) && (
            <div>
              {editionNote ? (
                <textarea
                  autoFocus
                  value={noteEnCours}
                  onChange={(e) => setNoteEnCours(e.target.value)}
                  onBlur={validerNote}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) validerNote();
                  }}
                  placeholder="Ex : le contrôle est reporté à vendredi"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-dj-bordure-forte bg-dj-surface px-2.5 py-1.5 text-sm text-dj-texte outline-none"
                />
              ) : (
                <button
                  onClick={() => {
                    setNoteEnCours(c.texte_libre || "");
                    setEditionNote(true);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg border border-dj-bordure bg-dj-surface px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte"
                >
                  <StickyNote size={13} className="mt-0.5 flex-shrink-0 text-dj-texte-muet" />
                  <span className="min-w-0 flex-1">{c.texte_libre}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Aplati l'arborescence des dossiers en une liste ordonnée parent avant
 * enfants, avec la profondeur de chacun (pour l'indentation visuelle). */
function ordonnerDossiers(dossiers: DossierBibliotheque[]): { dossier: DossierBibliotheque; profondeur: number }[] {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const parParent = new Map<string | null, DossierBibliotheque[]>();
  for (const d of dossiers) {
    const cle = d.dossier_parent_id;
    if (!parParent.has(cle)) parParent.set(cle, []);
    parParent.get(cle)!.push(d);
  }
  const resultat: { dossier: DossierBibliotheque; profondeur: number }[] = [];
  function visiter(parentId: string | null, profondeur: number) {
    const enfants = parParent.get(parentId) || [];
    for (const d of enfants) {
      resultat.push({ dossier: d, profondeur });
      visiter(d.id, profondeur + 1);
    }
  }
  visiter(null, 0);
  // Sécurité : un dossier dont le parent n'existe plus (jamais censé
  // arriver, mais mieux vaut l'afficher quand même qu'un dossier perdu).
  for (const d of dossiers) {
    if (d.dossier_parent_id && !parId.has(d.dossier_parent_id) && !resultat.find((r) => r.dossier.id === d.id)) {
      resultat.push({ dossier: d, profondeur: 0 });
    }
  }
  return resultat;
}

/**
 * 12/09/2026, chantier "Mes codes = un vrai éditeur" : un seul menu pour
 * attacher un skill/dossier déjà existant (clic direct, pas de case à
 * cocher séparée) ou en créer un nouveau. "Nouveau skill" ouvre l'éditeur
 * complet (EditeurComportement, voir MesCodes()) ; un nouveau dossier se
 * crée ici même (nom + Entrée) et s'attache aussitôt, comme avant.
 */
function AjoutContenuPopover({
  mesComportements,
  mesDossiers,
  idsComportementsActuels,
  idsDossiersActuels,
  onAttacherComportement,
  onAttacherDossier,
  onOuvrirNouveauComportement,
  onDossierCree,
}: {
  mesComportements: Comportement[];
  mesDossiers: DossierBibliotheque[];
  idsComportementsActuels: string[];
  idsDossiersActuels: string[];
  onAttacherComportement: (id: string) => void;
  onAttacherDossier: (id: string) => void;
  onOuvrirNouveauComportement: () => void;
  onDossierCree: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [nouveauDossierNom, setNouveauDossierNom] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const comportementsDisponibles = mesComportements.filter((cm) => !idsComportementsActuels.includes(cm.id));
  const dossiersDisponibles = ordonnerDossiers(mesDossiers).filter(({ dossier }) => !idsDossiersActuels.includes(dossier.id));

  async function creerDossierEtAttacher() {
    const nom = nouveauDossierNom.trim();
    if (!nom || creationEnCours) return;
    setCreationEnCours(true);
    setErreur(null);
    try {
      const dossier = await creerDossierBibliotheque(nom);
      onDossierCree();
      onAttacherDossier(dossier.id);
      setNouveauDossierNom("");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setCreationEnCours(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((p) => !p)}
        className="flex items-center gap-1 rounded-full border border-dashed border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <Plus size={12} /> Ajouter
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 flex w-64 flex-col gap-3 rounded-xl border border-dj-bordure bg-dj-surface p-3 shadow-lg">
            <div>
              <p className="mb-1.5 text-xs font-medium text-dj-texte-muet">Skills</p>
              {comportementsDisponibles.length > 0 && (
                <div className="mb-1 flex max-h-28 flex-col gap-0.5 overflow-y-auto">
                  {comportementsDisponibles.map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() => {
                        onAttacherComportement(cm.id);
                        setOuvert(false);
                      }}
                      className="truncate rounded-md px-2 py-1 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
                    >
                      {cm.nom || cm.description}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setOuvert(false);
                  onOuvrirNouveauComportement();
                }}
                className="flex items-center gap-1 text-xs text-dj-accent-1-texte hover:underline"
              >
                <Plus size={11} /> Nouveau skill
              </button>
            </div>

            <div className="border-t border-dj-bordure pt-2.5">
              <p className="mb-1.5 text-xs font-medium text-dj-texte-muet">Dossiers</p>
              {dossiersDisponibles.length > 0 && (
                <div className="mb-1.5 flex max-h-28 flex-col gap-0.5 overflow-y-auto">
                  {dossiersDisponibles.map(({ dossier, profondeur }) => (
                    <button
                      key={dossier.id}
                      onClick={() => {
                        onAttacherDossier(dossier.id);
                        setOuvert(false);
                      }}
                      style={{ paddingLeft: 8 + profondeur * 12 }}
                      className="truncate rounded-md px-2 py-1 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
                    >
                      {dossier.nom}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  value={nouveauDossierNom}
                  onChange={(e) => setNouveauDossierNom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && creerDossierEtAttacher()}
                  placeholder="Nouveau dossier…"
                  className="min-w-0 flex-1 rounded-md border border-dj-bordure bg-dj-surface-haute px-2 py-1 text-xs text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
                <button
                  onClick={creerDossierEtAttacher}
                  disabled={creationEnCours || !nouveauDossierNom.trim()}
                  className="flex-shrink-0 rounded-md bg-dj-accent-1 px-2 text-[#1A0D02] disabled:opacity-50"
                >
                  {creationEnCours ? "…" : <Plus size={12} />}
                </button>
              </div>
              {erreur && <p className="mt-1 text-xs text-[var(--dj-erreur)]">{erreur}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
