"use client";

import { useEffect, useState } from "react";
import { Plus, Check, Trash2, Copy, ChevronDown, ChevronUp, X } from "lucide-react";
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
import { CaseACocher } from "./CaseACocher";
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

        {codes.map((c) => {
          const estOuvert = ouvert === c.id;
          return (
            <div key={c.id} className="rounded-xl border border-dj-bordure bg-dj-surface-haute">
              <button
                onClick={() => setOuvert(estOuvert ? null : c.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={"h-1.5 w-1.5 flex-shrink-0 rounded-full " + (c.actif ? "bg-dj-accent-1" : "bg-dj-texte-muet")} />
                  <span className="truncate text-sm text-dj-texte">{c.nom || "Sans nom"}</span>
                  <span className="flex-shrink-0 rounded-md bg-dj-fond px-1.5 py-0.5 font-mono text-[11px] tracking-wider text-dj-texte-muet">
                    {c.code}
                  </span>
                </div>
                {estOuvert ? <ChevronUp size={16} className="flex-shrink-0 text-dj-texte-muet" /> : <ChevronDown size={16} className="flex-shrink-0 text-dj-texte-muet" />}
              </button>

              {estOuvert && (
                <div className="animate-dj-fade-in-rapide space-y-3 border-t border-dj-bordure px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copier(c.code)}
                      className="flex items-center gap-1 rounded-lg border border-dj-bordure px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:text-dj-texte"
                    >
                      <Copy size={12} /> {copieOk === c.code ? "Copié !" : "Copier le code"}
                    </button>
                    <button
                      onClick={() => toggleActif(c)}
                      className={
                        "ml-auto rounded-lg px-2 py-1 text-xs font-semibold transition-colors " +
                        (c.actif ? "text-dj-texte-muet hover:text-dj-texte" : "text-dj-accent-1-texte")
                      }
                    >
                      {c.actif ? "Désactiver" : "Réactiver"}
                    </button>
                    <button
                      onClick={() => supprimer(c.id)}
                      title="Supprimer ce code"
                      className="rounded-lg p-1.5 text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <ChampNom c={c} onSauver={(nom) => sauvegarder(c.id, { nom })} />
                  <ChampComportement
                    c={c}
                    mesComportements={mesComportements}
                    onSauver={(comportement_ids) => sauvegarder(c.id, { comportement_ids })}
                    onOuvrir={(id) => ouvrirEditeurComportement(c.id, id)}
                  />
                  <ChampDossiers
                    c={c}
                    mesDossiers={mesDossiers}
                    onSauver={(dossier_ids) => sauvegarder(c.id, { dossier_ids })}
                    onDossierCree={chargerDossiers}
                    onOuvrir={setDossierOuvert}
                  />
                  <ChampTexteLibre c={c} onSauver={(texte_libre) => sauvegarder(c.id, { texte_libre })} />
                </div>
              )}
            </div>
          );
        })}
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

function ChampNom({ c, onSauver }: { c: CodePartage; onSauver: (v: string) => void }) {
  const [valeur, setValeur] = useState(c.nom || "");
  return (
    <div>
      <label className="text-xs font-semibold text-dj-texte-muet">Nom (pour toi, pas pour les receveurs)</label>
      <div className="mt-1 flex gap-1.5">
        <input
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Ex : Mes CM2"
          className="flex-1 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
        {valeur !== (c.nom || "") && (
          <button onClick={() => onSauver(valeur)} className="rounded-lg bg-dj-accent-1 px-2.5 text-[#1A0D02]">
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 18/08/2026, demande Bourama : "je veux pas [...] tu écris ton
 * comportement tout de suite dans le code, mais tu choisis les
 * comportements déjà créé[s]". Remplace l'ancien textarea libre --
 * sélection multiple parmi les comportements déjà créés dans "Mes
 * comportements" (référence vivante, voir core/codes_partage.py :
 * modifier un comportement après coup met à jour tous les codes qui le
 * référencent). Sauvegarde immédiate à chaque coche, comme
 * ChampBibliotheque -- pas besoin d'un bouton "Enregistrer" séparé pour
 * des cases à cocher.
 */
function ChampComportement({
  c,
  mesComportements,
  onSauver,
  onOuvrir,
}: {
  c: CodePartage;
  mesComportements: Comportement[];
  onSauver: (v: string[]) => void;
  /** 12/09/2026, chantier "Mes codes = un vrai éditeur" : ouvre le skill
   * (id fourni) ou la création d'un nouveau (id null) dans l'éditeur --
   * voir MesCodes(), ouvrirEditeurComportement. */
  onOuvrir: (id: string | null) => void;
}) {
  // Replié par défaut (04/09/2026, demande Bourama) : même principe que le
  // dépliage de chaque code -- évite qu'une longue liste de comportements
  // prenne toute la place dès l'ouverture d'un code.
  const [ouvert, setOuvert] = useState(false);
  const idsActuels = c.comportements.map((cm) => cm.id);

  function basculer(id: string) {
    const nouveaux = idsActuels.includes(id) ? idsActuels.filter((i) => i !== id) : [...idsActuels, id];
    onSauver(nouveaux);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {mesComportements.length === 0 ? (
          <label className="text-xs font-semibold text-dj-texte-muet">Skills</label>
        ) : (
          <button
            type="button"
            onClick={() => setOuvert((prec) => !prec)}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-left"
          >
            <span className="text-xs font-semibold text-dj-texte-muet">
              Skills <span className="text-dj-texte">· {idsActuels.length} sélectionné{idsActuels.length > 1 ? "s" : ""}</span>
            </span>
            {ouvert ? <ChevronUp size={14} className="flex-shrink-0 text-dj-texte-muet" /> : <ChevronDown size={14} className="flex-shrink-0 text-dj-texte-muet" />}
          </button>
        )}
      </div>

      {mesComportements.length === 0 && (
        <p className="mt-1 text-xs text-dj-texte-muet">Aucun skill créé pour l&apos;instant.</p>
      )}

      {ouvert && mesComportements.length > 0 && (
        <div className="mt-1.5 flex animate-dj-fade-in-rapide flex-col gap-1.5 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-2">
          {mesComportements.map((cm) => (
            <div key={cm.id} className="flex items-center gap-2 text-sm text-dj-texte">
              <CaseACocher checked={idsActuels.includes(cm.id)} onChange={() => basculer(cm.id)} />
              <button
                type="button"
                onClick={() => onOuvrir(cm.id)}
                title="Ouvrir et modifier"
                className="min-w-0 flex-1 truncate text-left transition-colors hover:text-dj-accent-1-texte"
              >
                {cm.nom || cm.description}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOuvrir(null)}
        className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-dashed border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte"
      >
        <Plus size={13} /> Nouveau skill
      </button>
    </div>
  );
}

/** Aplati l'arborescence des dossiers en une liste ordonnée parent avant
 * enfants, avec la profondeur de chacun (pour l'indentation visuelle). */
function ordonnerDossiers(dossiers: DossierBibliotheque[]): { dossier: DossierBibliotheque; profondeur: number }[] {
  const enfants = new Map<string | null, DossierBibliotheque[]>();
  for (const d of dossiers) {
    const cle = d.dossier_parent_id;
    if (!enfants.has(cle)) enfants.set(cle, []);
    enfants.get(cle)!.push(d);
  }
  const resultat: { dossier: DossierBibliotheque; profondeur: number }[] = [];
  function visiter(parentId: string | null, profondeur: number) {
    for (const d of enfants.get(parentId) || []) {
      resultat.push({ dossier: d, profondeur });
      visiter(d.id, profondeur + 1);
    }
  }
  visiter(null, 0);
  return resultat;
}

/**
 * 02/09/2026, demande Bourama : remplace la case "Partager ma
 * bibliothèque" (tout ou rien) -- sélection précise d'un ou plusieurs
 * dossiers déjà créés dans la bibliothèque perso. Partager un dossier
 * partage aussi automatiquement tous ses sous-dossiers (géré côté
 * backend, voir core/codes_partage.py). Un champ permet aussi de créer
 * un nouveau dossier directement ici et de l'attacher dans la foulée,
 * sans passer par la bibliothèque d'abord. Sauvegarde immédiate à
 * chaque coche, comme ChampComportement.
 */
function ChampDossiers({
  c,
  mesDossiers,
  onSauver,
  onDossierCree,
  onOuvrir,
}: {
  c: CodePartage;
  mesDossiers: DossierBibliotheque[];
  onSauver: (v: string[]) => void;
  onDossierCree: () => void;
  /** 12/09/2026, chantier "Mes codes = un vrai éditeur" : ouvre ce
   * dossier (attaché ou non à ce code) dans la vraie Bibliothèque -- voir
   * MesCodes(), dossierOuvert. */
  onOuvrir: (dossierId: string) => void;
}) {
  const [nouveauNom, setNouveauNom] = useState("");
  const [creation, setCreation] = useState(false);
  // Replié par défaut (04/09/2026, demande Bourama), même principe que
  // ChampComportement -- la création d'un nouveau dossier reste toujours
  // visible en dessous, elle n'est pas concernée par ce repli.
  const [ouvert, setOuvert] = useState(false);
  const idsActuels = c.dossiers.map((d) => d.id);
  const ordonnes = ordonnerDossiers(mesDossiers);

  function basculer(id: string) {
    const nouveaux = idsActuels.includes(id) ? idsActuels.filter((i) => i !== id) : [...idsActuels, id];
    onSauver(nouveaux);
  }

  async function creerEtAttacher() {
    const nom = nouveauNom.trim();
    if (!nom || creation) return;
    setCreation(true);
    try {
      const dossier = (await creerDossierBibliotheque(nom)) as DossierBibliotheque;
      onDossierCree();
      onSauver([...idsActuels, dossier.id]);
      setNouveauNom("");
    } finally {
      setCreation(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-semibold text-dj-texte-muet">
        Dossiers partagés (sous-dossiers inclus, mis à jour au fil des ajouts)
      </label>
      {ordonnes.length === 0 ? (
        <p className="mt-1 text-xs text-dj-texte-muet">
          Aucun dossier créé pour l&apos;instant, crées-en un juste en dessous.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOuvert((prec) => !prec)}
            className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-left"
          >
            <span className="text-xs font-semibold text-dj-texte-muet">
              Dossiers <span className="text-dj-texte">· {idsActuels.length} sélectionné{idsActuels.length > 1 ? "s" : ""}</span>
            </span>
            {ouvert ? <ChevronUp size={14} className="flex-shrink-0 text-dj-texte-muet" /> : <ChevronDown size={14} className="flex-shrink-0 text-dj-texte-muet" />}
          </button>
          {ouvert && (
            <div className="mt-1.5 flex animate-dj-fade-in-rapide flex-col gap-1.5 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-2">
              {ordonnes.map(({ dossier, profondeur }) => (
                <div key={dossier.id} className="flex items-center gap-2 text-sm text-dj-texte" style={{ paddingLeft: profondeur * 16 }}>
                  <CaseACocher checked={idsActuels.includes(dossier.id)} onChange={() => basculer(dossier.id)} />
                  <button
                    type="button"
                    onClick={() => onOuvrir(dossier.id)}
                    title="Ouvrir et modifier"
                    className="min-w-0 flex-1 truncate text-left transition-colors hover:text-dj-accent-1-texte"
                  >
                    {dossier.nom}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && creerEtAttacher()}
          placeholder="Créer un nouveau dossier à partager"
          className="flex-1 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
        <button
          onClick={creerEtAttacher}
          disabled={creation || !nouveauNom.trim()}
          className="flex-shrink-0 rounded-lg bg-dj-accent-1 px-2.5 text-[#1A0D02] disabled:opacity-50"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function ChampTexteLibre({ c, onSauver }: { c: CodePartage; onSauver: (v: string) => void }) {
  const [valeur, setValeur] = useState(c.texte_libre || "");
  return (
    <div>
      <label className="text-xs font-semibold text-dj-texte-muet">Texte libre (une annonce)</label>
      <div className="mt-1 flex gap-1.5">
        <textarea
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Ex : le contrôle est reporté à vendredi"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
        />
        {valeur !== (c.texte_libre || "") && (
          <button onClick={() => onSauver(valeur)} className="self-start rounded-lg bg-dj-accent-1 px-2.5 py-1.5 text-[#1A0D02]">
            <Check size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
