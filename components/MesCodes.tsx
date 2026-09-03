"use client";

import { useEffect, useState } from "react";
import { Plus, Check, Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
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
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { BoutonInfoSection } from "./BoutonInfoSection";
import { CaseACocher } from "./CaseACocher";

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

  function chargerDossiers() {
    listerDossiersBibliotheque().then(setMesDossiers).catch(() => setMesDossiers([]));
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
    lireMesComportements(AGENT_ID).then(setMesComportements).catch(() => setMesComportements([]));
    chargerDossiers();
  }, []);

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

  return (
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
                  />
                  <ChampDossiers
                    c={c}
                    mesDossiers={mesDossiers}
                    onSauver={(dossier_ids) => sauvegarder(c.id, { dossier_ids })}
                    onDossierCree={chargerDossiers}
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
}: {
  c: CodePartage;
  mesComportements: Comportement[];
  onSauver: (v: string[]) => void;
}) {
  const idsActuels = c.comportements.map((cm) => cm.id);

  function basculer(id: string) {
    const nouveaux = idsActuels.includes(id) ? idsActuels.filter((i) => i !== id) : [...idsActuels, id];
    onSauver(nouveaux);
  }

  return (
    <div>
      <label className="text-xs font-semibold text-dj-texte-muet">Skills</label>
      {mesComportements.length === 0 ? (
        <p className="mt-1 text-xs text-dj-texte-muet">
          Aucun comportement créé pour l&apos;instant. Crées-en un dans &quot;Mes comportements&quot; pour pouvoir
          l&apos;attacher ici.
        </p>
      ) : (
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-2">
          {mesComportements.map((cm) => (
            <label key={cm.id} className="flex items-center gap-2 text-sm text-dj-texte">
              <CaseACocher checked={idsActuels.includes(cm.id)} onChange={() => basculer(cm.id)} />
              <span className="min-w-0 truncate">{cm.nom || cm.description}</span>
            </label>
          ))}
        </div>
      )}
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
}: {
  c: CodePartage;
  mesDossiers: DossierBibliotheque[];
  onSauver: (v: string[]) => void;
  onDossierCree: () => void;
}) {
  const [nouveauNom, setNouveauNom] = useState("");
  const [creation, setCreation] = useState(false);
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
        <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-dj-bordure bg-dj-surface px-2.5 py-2">
          {ordonnes.map(({ dossier, profondeur }) => (
            <label
              key={dossier.id}
              className="flex items-center gap-2 text-sm text-dj-texte"
              style={{ paddingLeft: profondeur * 16 }}
            >
              <CaseACocher checked={idsActuels.includes(dossier.id)} onChange={() => basculer(dossier.id)} />
              <span className="min-w-0 truncate">{dossier.nom}</span>
            </label>
          ))}
        </div>
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
