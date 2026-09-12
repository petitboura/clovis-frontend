"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trash2, X, Check, FileCode2, Loader2, Link2, Unlink, Eye, Code2, Upload, Download, FileUp, FolderUp, Info,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  ajouterComportement,
  importerComportementDepuisFichier,
  modifierComportement,
  attacherComportement,
  supprimerComportement,
  lireSkillComportement,
  modifierSkillComportement,
  publierComportement,
  type Comportement,
} from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { telechargerTexte, nomFichierDepuis } from "@/lib/telechargerTexte";
import { OngletsSegment } from "./OngletsSegment";
import { CaseACocher } from "./CaseACocher";
import { BulleSurvol } from "./BulleSurvol";
import { ButtonPartager, lienPartage } from "./ButtonPartager";
import { SelecteurCodesPartage } from "./SelecteurCodesPartage";

// Même découpage que côté backend (core/comportements_etudiants.py) :
// un skill_md valide est "---\n<frontmatter>\n---\n<corps>".
function extraireCorpsSkill(skillMd: string): string {
  const correspondance = skillMd.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return correspondance ? correspondance[1].trim() : skillMd;
}

/**
 * 12/09/2026, chantier "Mes codes = un vrai éditeur" (demande Bourama) :
 * extrait du panneau plein écran qui vivait à l'intérieur de
 * MesComportements.tsx -- même contenu, même comportement, mais séparé
 * pour être monté ailleurs (Mes codes) sans dupliquer toute cette
 * logique. C'est l'appelant qui décide de l'habillage (PanneauFlottant
 * en plein écran comme avant, ou panneau nu dans une vue divisée) --
 * ce composant ne rend que l'en-tête + le contenu du panneau.
 *
 * `comportement` = null signifie "création" (même sémantique que l'ancien
 * `panneau.type === "creation"`).
 */
export function EditeurComportement({
  agentId,
  comportement,
  onFermer,
  onCree,
  onModifie,
  onSupprime,
  boutonFermerDesactive,
  onActionEnCoursChange,
}: {
  agentId: string;
  comportement: Comportement | null;
  onFermer: () => void;
  onCree: (c: Comportement) => void;
  onModifie: (c: Comportement) => void;
  onSupprime: (id: string) => void;
  /** Passé par l'appelant s'il veut désactiver la fermeture pendant une
   * animation/action qui lui est propre -- combiné en interne avec les
   * actions en cours de CE composant. */
  boutonFermerDesactive?: boolean;
  /** Prévient l'appelant qu'une action (enregistrement/suppression/etc.)
   * est en cours, pour qu'il puisse lui aussi désactiver sa propre
   * fermeture (clic sur le fond, Echap -- voir PanneauFlottant.tsx),
   * comme avant l'extraction de ce composant. */
  onActionEnCoursChange?: (enCours: boolean) => void;
}) {
  const estCreation = comportement === null;

  const [comportementActuel, setComportementActuel] = useState(comportement);
  const [texteOuvert, setTexteOuvert] = useState(comportement?.texte || "");
  const [nomOuvert, setNomOuvert] = useState(comportement?.nom || "");
  const [nomAuto, setNomAuto] = useState(estCreation);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurOuvert, setErreurOuvert] = useState<string | null>(null);

  // 22/08/2026 (comportement conservé) : ouverture directe sur l'onglet
  // "skill" + sous-vue "Aperçu" pour un skill existant -- pas le texte
  // brut ni le code en premier.
  const [onglet, setOnglet] = useState<"texte" | "skill" | "codes">(estCreation ? "texte" : "skill");
  const [skillOuvert, setSkillOuvert] = useState("");
  const [skillChargement, setSkillChargement] = useState(false);
  const [skillEnregistrementEnCours, setSkillEnregistrementEnCours] = useState(false);
  const [erreurSkill, setErreurSkill] = useState<string | null>(null);
  const [skillVue, setSkillVue] = useState<"texte" | "apercu">("apercu");

  const [detachementEnCours, setDetachementEnCours] = useState(false);

  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [publie, setPublie] = useState(false);
  const [erreurPublication, setErreurPublication] = useState<string | null>(null);

  const [importEnCours, setImportEnCours] = useState(false);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [erreursImportLot, setErreursImportLot] = useState<{ nom: string; erreur: string }[]>([]);
  const inputImportRef = useRef<HTMLInputElement>(null);
  const inputImportDossierRef = useRef<HTMLInputElement>(null);

  async function chargerSkill(comportementId: string) {
    setSkillChargement(true);
    setErreurSkill(null);
    try {
      const md = await lireSkillComportement(agentId, comportementId);
      setSkillOuvert(md);
    } catch (e) {
      setErreurSkill(messageErreur(e));
    } finally {
      setSkillChargement(false);
    }
  }

  useEffect(() => {
    if (!estCreation && comportementActuel) chargerSkill(comportementActuel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ouvrirOngletSkill() {
    setOnglet("skill");
    if (estCreation || skillOuvert || skillChargement || !comportementActuel) return;
    chargerSkill(comportementActuel.id);
  }

  async function enregistrerSkill() {
    if (estCreation || !comportementActuel) return;
    const skillMd = skillOuvert.trim();
    if (!skillMd) return;
    setSkillEnregistrementEnCours(true);
    setErreurSkill(null);
    try {
      const maj = await modifierSkillComportement(agentId, comportementActuel.id, skillMd);
      setComportementActuel(maj);
      onModifie(maj);
    } catch (e) {
      setErreurSkill(messageErreur(e));
    } finally {
      setSkillEnregistrementEnCours(false);
    }
  }

  async function importerFichier(f: File) {
    if (!estCreation) return;
    setImportEnCours(true);
    setErreurImport(null);
    const nomDepuisFichier = f.name.replace(/\.md$/i, "");
    try {
      const cree = await importerComportementDepuisFichier(agentId, f, nomAuto ? nomDepuisFichier : nomOuvert.trim() || nomDepuisFichier);
      onCree(cree);
      onFermer();
    } catch (e) {
      setErreurImport(messageErreur(e));
    } finally {
      setImportEnCours(false);
    }
  }

  async function importerPlusieursFichiers(fichiersChoisis: FileList | File[]) {
    if (!estCreation) return;
    const tousLesFichiers = Array.from(fichiersChoisis);
    const fichiersMd = tousLesFichiers.filter((f) => /\.md$/i.test(f.name));
    if (fichiersMd.length === 0) return;

    setImportEnCours(true);
    setErreurImport(null);
    setErreursImportLot([]);
    const erreurs: { nom: string; erreur: string }[] = [];

    for (const f of fichiersMd) {
      const nomFichierSeul = f.name.split("/").pop() || f.name;
      const nomDepuisFichier = nomFichierSeul.replace(/\.md$/i, "");
      try {
        const cree = await importerComportementDepuisFichier(agentId, f, nomDepuisFichier);
        onCree(cree);
      } catch (e) {
        erreurs.push({ nom: nomFichierSeul, erreur: messageErreur(e) });
      }
    }

    setErreursImportLot(erreurs);
    setImportEnCours(false);
    if (erreurs.length === 0) onFermer();
  }

  function telechargerSkillActuel() {
    if (estCreation || !skillOuvert) return;
    telechargerTexte(nomFichierDepuis(comportementActuel?.nom || "skill", "md"), skillOuvert);
  }

  async function detacher() {
    if (estCreation || !comportementActuel) return;
    setDetachementEnCours(true);
    setErreurOuvert(null);
    try {
      const maj = await attacherComportement(agentId, comportementActuel.id, null, null);
      setComportementActuel(maj);
      onModifie(maj);
    } catch (e) {
      setErreurOuvert(messageErreur(e));
    } finally {
      setDetachementEnCours(false);
    }
  }

  async function enregistrer() {
    const texte = texteOuvert.trim();
    if (!texte) return;
    const nom = nomAuto ? null : nomOuvert.trim() || null;

    if (estCreation) {
      setEnregistrementEnCours(true);
      setErreurOuvert(null);
      try {
        const cree = await ajouterComportement(agentId, texte, nom);
        onCree(cree);
        onFermer();
      } catch (e) {
        setErreurOuvert(messageErreur(e));
      } finally {
        setEnregistrementEnCours(false);
      }
      return;
    }

    if (!comportementActuel) return;
    if (texte === comportementActuel.texte && nom === (comportementActuel.nom || null)) {
      onFermer();
      return;
    }
    setEnregistrementEnCours(true);
    setErreurOuvert(null);
    try {
      const maj = await modifierComportement(agentId, comportementActuel.id, texte, nom);
      setComportementActuel(maj);
      onModifie(maj);
      onFermer();
    } catch (e) {
      setErreurOuvert(messageErreur(e));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function supprimer() {
    if (estCreation || !comportementActuel) return;
    setSuppressionEnCours(true);
    setErreurOuvert(null);
    try {
      await supprimerComportement(agentId, comportementActuel.id);
      onSupprime(comportementActuel.id);
      onFermer();
    } catch (e) {
      setErreurOuvert(messageErreur(e));
      setSuppressionEnCours(false);
    }
  }

  async function publier() {
    if (estCreation || !comportementActuel) return;
    setPublicationEnCours(true);
    setErreurPublication(null);
    try {
      await publierComportement(agentId, comportementActuel.id);
      setPublie(true);
    } catch (e) {
      setErreurPublication(messageErreur(e));
    } finally {
      setPublicationEnCours(false);
    }
  }

  const actionEnCours = enregistrementEnCours || suppressionEnCours || skillEnregistrementEnCours || detachementEnCours;

  useEffect(() => {
    onActionEnCoursChange?.(actionEnCours);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionEnCours]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-dj-texte">{estCreation ? "Nouveau skill" : "Modifier ce skill"}</span>
          {!estCreation && (
            <BulleSurvol
              texte="Ce que l'IA lit vraiment quand elle consulte ce comportement. Tu peux le corriger directement ici -- si tu réédites le texte brut plus tard, il sera régénéré et remplacera ce que tu écris ici."
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-dj-texte-muet hover:text-dj-texte"
            >
              <Info size={12} />
            </BulleSurvol>
          )}
          {!estCreation && comportementActuel && (
            <ButtonPartager lien={lienPartage("skill-perso", comportementActuel.id)} titre={comportementActuel.nom || undefined} variante="icone" />
          )}
        </span>
        <button
          onClick={onFermer}
          disabled={actionEnCours || boutonFermerDesactive}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
        >
          <X size={14} /> Fermer
        </button>
      </div>

      <div className="mb-3 flex-shrink-0">
        <OngletsSegment
          ariaLabel="Vue du skill"
          valeur={onglet}
          onChange={(v) => (v === "skill" ? ouvrirOngletSkill() : setOnglet(v as typeof onglet))}
          onglets={
            estCreation
              ? [{ valeur: "texte", libelle: "Texte" }]
              : [
                  { valeur: "texte", libelle: "Texte" },
                  { valeur: "skill", libelle: "Voir le skill généré", icone: FileCode2 },
                  { valeur: "codes", libelle: "Codes", icone: Link2 },
                ]
          }
        />
      </div>

      {onglet === "codes" && !estCreation && comportementActuel && (
        <SelecteurCodesPartage type="comportement" id={comportementActuel.id} />
      )}

      {onglet === "texte" && (
        <>
          {!estCreation && comportementActuel?.lien_libelle && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-xs text-dj-texte-muet">
              <span className="flex items-center gap-1.5">
                <Link2 size={12} /> Attaché à : <span className="text-dj-texte">{comportementActuel.lien_libelle}</span>
              </span>
              <button
                onClick={detacher}
                disabled={detachementEnCours}
                className="flex flex-shrink-0 items-center gap-1 text-dj-texte-muet transition-colors hover:text-[var(--dj-erreur)] disabled:opacity-50"
              >
                <Unlink size={12} /> {detachementEnCours ? "…" : "Détacher"}
              </button>
            </div>
          )}
          <div className="flex w-full flex-col gap-1.5 pb-3 sm:flex-row sm:items-center">
            <input
              value={nomAuto ? "" : nomOuvert}
              onChange={(e) => setNomOuvert(e.target.value)}
              disabled={nomAuto}
              placeholder={nomAuto ? "Nom généré automatiquement" : "Ex : Réponses en langage simple"}
              className="flex-1 rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-3 py-1.5 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte disabled:opacity-50"
            />
            <label className="flex flex-shrink-0 items-center gap-1.5 text-xs text-dj-texte-muet">
              <CaseACocher checked={nomAuto} onChange={setNomAuto} />
              Auto
            </label>
          </div>

          {!estCreation && (
            <p className="pb-3 text-xs text-dj-texte-muet">
              <span className="font-medium text-dj-texte-muet">Description :</span> {comportementActuel?.description || "—"}
            </p>
          )}

          {estCreation && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-dashed border-dj-bordure px-3 py-2">
              <span className="text-xs text-dj-texte-muet">Déjà un ou plusieurs skills rédigés ? Importe-les tels quels.</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={inputImportRef}
                  type="file"
                  accept=".md"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const fichiers = e.target.files;
                    if (!fichiers || fichiers.length === 0) return;
                    if (fichiers.length === 1) importerFichier(fichiers[0]);
                    else importerPlusieursFichiers(fichiers);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => inputImportRef.current?.click()}
                  disabled={importEnCours}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
                >
                  {importEnCours ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                  {importEnCours ? "Import…" : "Uploader des .md"}
                </button>

                <input
                  ref={inputImportDossierRef}
                  type="file"
                  className="hidden"
                  // @ts-expect-error -- webkitdirectory n'est pas dans le typage React standard, mais bien supporté par les navigateurs
                  webkitdirectory=""
                  onChange={(e) => {
                    const fichiers = e.target.files;
                    if (fichiers && fichiers.length > 0) importerPlusieursFichiers(fichiers);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => inputImportDossierRef.current?.click()}
                  disabled={importEnCours}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-dj-bordure px-2.5 py-1.5 text-xs text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
                  title="Seuls les fichiers .md du dossier seront importés, le reste est ignoré"
                >
                  {importEnCours ? <Loader2 size={13} className="animate-spin" /> : <FolderUp size={13} />}
                  {importEnCours ? "Import…" : "Importer un dossier"}
                </button>
              </div>
              {erreurImport && <p className="pb-3 text-xs text-[var(--dj-erreur)]">{erreurImport}</p>}
              {erreursImportLot.length > 0 && (
                <div className="mb-3 flex flex-col gap-1 rounded-lg border border-[var(--dj-erreur)] px-3 py-2 text-xs text-[var(--dj-erreur)]">
                  <p className="font-medium">
                    {erreursImportLot.length} fichier{erreursImportLot.length > 1 ? "s n'ont" : " n'a"} pas pu être importé
                    {erreursImportLot.length > 1 ? "s" : ""} :
                  </p>
                  {erreursImportLot.map((e, i) => (
                    <p key={i}>
                      « {e.nom} » : {e.erreur}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            autoFocus
            value={texteOuvert}
            onChange={(e) => setTexteOuvert(e.target.value)}
            placeholder="Ex : réponds-moi toujours en langage simple"
            rows={16}
            className="w-full flex-1 resize-none rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-4 py-3 text-base text-dj-texte outline-none focus:border-dj-bordure-forte"
          />

          <div className="flex w-full flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {erreurOuvert || erreurPublication ? (
              <p className="text-xs text-[var(--dj-erreur)]">{erreurOuvert || erreurPublication}</p>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!estCreation && (
                <>
                  <button
                    onClick={publier}
                    disabled={publicationEnCours || enregistrementEnCours || suppressionEnCours}
                    title="Publier une copie dans le catalogue public -- n'importe qui pourra l'activer"
                    className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-2 text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
                  >
                    <Upload size={14} /> {publicationEnCours ? "Publication…" : publie ? "Publié !" : "Publier"}
                  </button>
                  <button
                    onClick={supprimer}
                    disabled={enregistrementEnCours || suppressionEnCours}
                    className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-2 text-sm text-[var(--dj-erreur)] transition-colors hover:bg-[var(--dj-erreur)]/10 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </>
              )}
              <button
                onClick={enregistrer}
                disabled={enregistrementEnCours || suppressionEnCours || !texteOuvert.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                <Check size={14} /> {enregistrementEnCours ? "Enregistrement…" : estCreation ? "Créer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </>
      )}

      {onglet === "skill" && !estCreation && (
        <>
          <div className="flex items-start justify-between gap-2 pb-2">
            <p className="min-w-0 flex-1 text-xs text-dj-texte-muet">{comportementActuel?.description || "Pas de description."}</p>
            <div className="flex flex-shrink-0 gap-1 rounded-lg border border-dj-bordure p-0.5">
              <button
                onClick={() => setSkillVue("texte")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  skillVue === "texte" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
                }`}
              >
                <Code2 size={13} /> Texte
              </button>
              <button
                onClick={() => setSkillVue("apercu")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  skillVue === "apercu" ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:text-dj-texte"
                }`}
              >
                <Eye size={13} /> Aperçu
              </button>
            </div>
          </div>
          {skillChargement ? (
            <div className="flex flex-1 items-center justify-center text-dj-texte-muet">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : skillVue === "texte" ? (
            <textarea
              value={skillOuvert}
              onChange={(e) => setSkillOuvert(e.target.value)}
              rows={16}
              spellCheck={false}
              className="w-full flex-1 resize-none rounded-cgpt-carte border border-dj-bordure bg-dj-surface-haute px-4 py-3 font-mono text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
          ) : (
            <div className="w-full rounded-xl border border-dj-bordure bg-dj-surface-haute px-5 py-4">
              <div className="dj-markdown [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 last:[&_p]:mb-0 [&_hr]:my-4 [&_hr]:border-dj-bordure [&_strong]:text-dj-texte [&_h1]:font-lecture [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] [&_h1]:text-dj-texte [&_h1]:text-xl [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:font-lecture [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-dj-texte [&_h2]:text-lg [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:font-lecture [&_h3]:font-semibold [&_h3]:tracking-[-0.01em] [&_h3]:text-dj-texte [&_h3]:text-base [&_h3]:mb-1.5 [&_h3]:mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeSanitize, defaultSchema]]}>
                  {extraireCorpsSkill(skillOuvert)}
                </ReactMarkdown>
              </div>
            </div>
          )}
          <div className="flex w-full flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {erreurSkill || erreurPublication ? (
              <p className="text-xs text-[var(--dj-erreur)]">{erreurSkill || erreurPublication}</p>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={telechargerSkillActuel}
                disabled={skillChargement || !skillOuvert.trim()}
                title="Télécharger ce skill en .md"
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-2 text-sm text-dj-texte-muet transition-colors hover:border-dj-bordure-forte hover:text-dj-texte disabled:opacity-50"
              >
                <Download size={14} /> Télécharger
              </button>
              <button
                onClick={publier}
                disabled={publicationEnCours || skillEnregistrementEnCours || skillChargement}
                title="Publier une copie dans le catalogue public -- n'importe qui pourra l'activer"
                className="flex items-center gap-1.5 rounded-lg border border-dj-bordure px-3 py-2 text-sm text-dj-texte transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
              >
                <Upload size={14} /> {publicationEnCours ? "Publication…" : publie ? "Publié !" : "Publier"}
              </button>
              <button
                onClick={enregistrerSkill}
                disabled={skillEnregistrementEnCours || skillChargement || !skillOuvert.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-dj-accent-1 px-4 py-2 text-sm font-semibold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
              >
                <Check size={14} /> {skillEnregistrementEnCours ? "Enregistrement…" : "Enregistrer le skill"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
