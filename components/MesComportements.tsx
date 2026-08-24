"use client";

import { useEffect, useState, type MouseEvent } from "react";
import {
  Trash2, Plus, X, Check, ScrollText, FileCode2, Loader2, Link2, Unlink, Eye, Code2, Upload, ToggleLeft, ToggleRight,
  Download, ClipboardCheck, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  lireMesComportements,
  ajouterComportement,
  modifierComportement,
  attacherComportement,
  supprimerComportement,
  lireSkillComportement,
  modifierSkillComportement,
  activerDesactiverComportement,
  publierComportement,
  type Comportement,
} from "@/lib/api";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { ComportementsRecus } from "@/components/ComportementsRecus";
import { ComportementsPublics } from "@/components/ComportementsPublics";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { Skeleton } from "./Skeleton";

// Section "Mes comportements" (06/08/2026, demande Bourama : "on peut en
// mettre plusieurs hein, pas juste un") : PLUSIEURS instructions perso
// écrites par l'étudiant, chacune ajoutée EN PLUS du system_prompt déjà
// résolu (généraliste, matière d'un enseignant, ou "Sans enseignant") --
// jamais un remplacement, voir core/main.py::_construire_system_prompt.
//
// Refonte visuelle (16/08/2026, demande Bourama : la section "doit être
// plus sérieuse") : ce composant vivait à l'origine dans l'ancienne
// sidebar de chat (SidebarChat.tsx, aujourd'hui disparue) et avait gardé
// son style panneau compact (texte minuscule, simple point coloré par
// ligne) même après être devenu une vraie page à part entière
// (app/(app)/comportements/page.tsx, refonte "Mon espace = l'app" du
// 15/08). Aligné ici sur le même langage visuel que les autres sections
// (voir EspaceBibliotheque.tsx) : cartes bordées, texte en taille
// normale, formulaire d'ajout en encart, CTA compte partagé
// (CTACompteRequis) au lieu d'une version dupliquée sur mesure.
//
// Ouvert aux visiteurs sans compte depuis le 09/08 (la barre latérale
// entière l'est désormais, décision Bourama : "tout est visible, la
// seule différence c'est que ça demande un compte au clic") : cette
// section est en revanche intrinsèquement liée à un compte (instructions
// perso PAR utilisateur) -- même la lecture initiale exige une session
// côté backend. Un visiteur sans session voit donc un CTA "Crée un
// compte" à la place de la liste, pas une liste vide silencieuse.
//
// Édition plein écran par élément (07/08/2026, demande Bourama : "je
// parle pas de la section, je parle de chaque élément de la liste --
// chaque élément qui peut s'agrandir, est cliquable pour l'ouvrir et
// bien l'éditer") : cliquer sur un comportement existant ouvre CET
// élément précis dans un espace dédié plein écran (grand champ de
// texte, Enregistrer, Supprimer).
//
// 18/08/2026, demande Bourama ("rends-le sérieux, en fait un vrai
// skill quoi") : la barre rapide d'ajout (petit input + bouton
// "Ajouter" au fil de l'eau) est supprimée. La création passe désormais
// UNIQUEMENT par le même panneau plein écran que l'édition -- texte +
// nom (choisi ou "Auto") ensemble, dès la création, plutôt qu'un ajout
// à la va-vite sans nom suivi d'une édition séparée pour en mettre un.

// 18/08/2026, demande Bourama ("les deux : édite le texte, l'impacte,
// ou tu peux l'éditer directement") : onglet "Voir le skill généré" en
// plus de l'onglet Texte -- lecture ET édition DIRECTE du skill complet
// (frontmatter + corps) stocké côté serveur, chargé à la demande
// (lireSkillComportement) seulement à l'ouverture de cet onglet, jamais
// eagerly dans la liste. Éditer et enregistrer le Texte régénère
// toujours le skill depuis ce texte (comportement inchangé, voir plus
// haut) -- éditer directement le skill l'écrase sans toucher au texte
// ni au nom ; si le texte est réédité ensuite, le skill regénéré
// écrasera à son tour cette édition manuelle (voulu, pas un bug).
//
// Sous-bascule Texte/Aperçu (18/08, avec capture d'écran, demande
// Bourama : "il faut les deux, comme ici, un bouton qui affiche le
// texte et un autre qui affiche le skill") : "Aperçu" rend le CORPS
// seul (frontmatter technique masqué, pas fait pour l'étudiant) en vrai
// Markdown -- mêmes plugins/classes dj-markdown que le chat (voir
// BulleMessage.tsx), pour un rendu cohérent avec le reste de l'app.
// Même découpage que _RE_FRONTMATTER côté backend
// (core/comportements_etudiants.py) : un skill_md valide est
// "---\n<frontmatter>\n---\n<corps>". Si le format est invalide
// (skill_md vide, pas encore chargé, ou édition manuelle cassée avant
// enregistrement), on retombe sur le texte brut plutôt que de planter
// le rendu.
function extraireCorpsSkill(skillMd: string): string {
  const correspondance = skillMd.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return correspondance ? correspondance[1].trim() : skillMd;
}

// Puce d'un skill dans la liste (extrait le 22/08/2026 pour être réutilisé
// à la fois dans la liste plate normale et dans les groupes par matière de
// l'onglet "Audits" -- même rendu, une seule source de vérité).
function ChipComportement({
  c,
  onOuvrir,
  onToggleActif,
}: {
  c: Comportement;
  onOuvrir: (c: Comportement) => void;
  onToggleActif: (c: Comportement, e: MouseEvent) => void;
}) {
  return (
    <button
      onClick={() => onOuvrir(c)}
      title="Ouvrir et modifier"
      className={`group flex max-w-[280px] flex-col gap-1 rounded-full border border-dj-bordure bg-dj-surface px-3.5 py-2 text-left transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute ${
        c.actif ? "" : "opacity-50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ScrollText size={14} className="flex-shrink-0 text-dj-texte-muet" />
        <span className="min-w-0 flex-1 truncate text-sm text-dj-texte">{c.nom || c.description}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleActif(c, e)}
          title={c.actif ? "Désactiver (ne sera plus proposé à l'IA)" : "Activer"}
          className="flex flex-shrink-0 items-center text-dj-texte-muet hover:text-dj-texte disabled:opacity-40"
        >
          {c.actif ? <ToggleRight size={18} className="text-dj-accent-1" /> : <ToggleLeft size={18} />}
        </span>
      </div>
      {/* Badge de rattachement (lien_libelle) sur sa propre ligne, sous le
          nom -- CORRECTIF 22/08/2026 (Bourama : "le texte des sources
          déborde, on ne voit plus les noms") : avant, ce badge partageait
          la ligne du nom en flex-shrink-0, donc un chapitre au nom long
          écrasait le nom du skill au lieu de se réduire lui-même. Ici il a
          sa propre largeur (celle du chip) et sa propre troncature. */}
      {c.lien_libelle && (
        <span className="ml-[22px] flex min-w-0 items-center gap-1 self-start rounded-full bg-dj-surface-haute px-2 py-0.5 text-[10px] text-dj-texte-muet">
          <Link2 size={9} className="flex-shrink-0" />
          <span className="min-w-0 truncate">{c.lien_libelle}</span>
        </span>
      )}
    </button>
  );
}

export function MesComportements({ agentId }: { agentId: string }) {
  const [liste, setListe] = useState<Comportement[] | undefined>(undefined);

  // 21/08/2026, demande Bourama : "je veux un onglet public" -- bascule
  // entre la liste perso (comportement par défaut) et le catalogue
  // public (nouveau composant ComportementsPublics.tsx, même esprit que
  // EspacePlugins.tsx pour les plugins).
  const [vue, setVue] = useState<"mes-comportements" | "public">("mes-comportements");

  // 22/08/2026, demande Bourama : distinguer les 4 origines d'un skill
  // (créé directement / téléchargé du public / attaché à un emplacement
  // du programme / issu d'un audit) par des onglets-filtres au-dessus de
  // la liste. Non exclusif par design (confirmé par Bourama) : un skill
  // peut correspondre à plusieurs onglets à la fois -- ex: téléchargé du
  // public PUIS attaché à un chapitre apparaît dans "Public" ET
  // "Attachés". Exception volontaire : un skill issu d'un audit a
  // TOUJOURS un lien_type/lien_id (voir
  // core/audit_programme.py::_synchroniser_skill_audit), donc il serait
  // systématiquement compté aussi dans "Attachés" si on ne l'excluait pas
  // -- choisi de le réserver à "Audits" pour que "Attachés" reste utile
  // (les dizaines de skills d'audit l'auraient sinon noyé). À ajuster si
  // Bourama préfère l'inverse.
  //
  // Pas de mécanisme i18n branché sur ce composant (même constat que
  // EspacePlugins.tsx, vérifié 22/08) -- libellés en français en dur
  // comme le reste du fichier, à signaler à Bourama si la traduction
  // doit être ajoutée plus tard.
  type FiltreOrigine = "tous" | "crees" | "public" | "attaches" | "audits";
  const [filtreOrigine, setFiltreOrigine] = useState<FiltreOrigine>("tous");

  // 22/08/2026, demande Bourama : groupes repliables par matière dans
  // l'onglet "Audits" -- fermés par défaut (potentiellement des dizaines
  // de chapitres), clé = matiere_id (ou "sans-matiere" en repli).
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(new Set());

  function correspondFiltre(c: Comportement, f: FiltreOrigine): boolean {
    switch (f) {
      case "tous":
        return true;
      case "crees":
        return !c.depuis_audit && !c.depuis_public;
      case "public":
        return c.depuis_public;
      case "attaches":
        return !c.depuis_audit && !!c.lien_type && !!c.lien_id;
      case "audits":
        return c.depuis_audit;
    }
  }

  // Toggle actif/inactif par comportement (21/08, demande Bourama :
  // "ajoute activer et désactiver aux comportements") -- suivi par id
  // pour désactiver juste le bouton concerné pendant l'appel, sans
  // bloquer toute la liste.
  const [actifEnCours, setActifEnCours] = useState<string | null>(null);

  // Publication vers le catalogue public (21/08) -- retour visuel bref
  // sur le bouton du panneau, pas de redirection ni de fermeture auto.
  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [publie, setPublie] = useState(false);
  const [erreurPublication, setErreurPublication] = useState<string | null>(null);

  // Panneau plein écran : soit édition d'un comportement existant, soit
  // création d'un nouveau (07/08/2026, demande Bourama : "le mode plein
  // écran ne doit pas être dispo que pour ceux qui existent -- en mode
  // édition [ajout] il faut aussi un truc à côté de la ligne de champ").
  // Depuis le 18/08 (voir plus haut), c'est le SEUL chemin de création,
  // plus de raccourci en parallèle.
  const [panneau, setPanneau] = useState<{ type: "edition"; c: Comportement } | { type: "creation" } | null>(null);
  const [texteOuvert, setTexteOuvert] = useState("");
  // Nom d'affichage (18/08/2026, demande Bourama) : soit choisi par
  // l'étudiant, soit "Auto" (généré côté serveur avec le skill, même
  // appel LLM, aucun coût en plus). Seul endroit de création/édition
  // depuis la suppression de la barre rapide -- voir plus haut.
  const [nomOuvert, setNomOuvert] = useState("");
  const [nomAuto, setNomAuto] = useState(true);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurOuvert, setErreurOuvert] = useState<string | null>(null);
  const [sansCompte, setSansCompte] = useState(false);

  // Onglet du panneau -- "skill" seulement pertinent en édition (un
  // comportement en création n'a pas encore de skill à afficher, voir
  // le rendu conditionnel plus bas).
  const [onglet, setOnglet] = useState<"texte" | "skill">("texte");
  const [skillOuvert, setSkillOuvert] = useState("");
  const [skillChargement, setSkillChargement] = useState(false);
  const [skillEnregistrementEnCours, setSkillEnregistrementEnCours] = useState(false);
  const [erreurSkill, setErreurSkill] = useState<string | null>(null);
  const [skillVue, setSkillVue] = useState<"texte" | "apercu">("texte");

  // Détachement (20/08, demande Bourama : "au moment de la création ou
  // après tu peux l'attacher" -- l'inverse, détacher, doit être possible
  // aussi, depuis ce même panneau).
  const [detachementEnCours, setDetachementEnCours] = useState(false);

  // 18/08/2026, voir lib/useFermetureAnimee.ts : anime la fermeture du
  // panneau au lieu de le démonter d'un coup.
  const { enSortie, demarrerFermeture } = useFermetureAnimee();

  function charger() {
    lireMesComportements(agentId)
      .then(setListe)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
          setListe([]);
        } else {
          setListe([]);
        }
      });
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // 15/08 (demande Bourama : "quand l'IA crée un comportement on ne le
  // voit pas") : l'IA peut créer/modifier/supprimer un comportement
  // elle-même depuis le chat (ajouter_comportement, etc.) -- ce panneau
  // ne rechargeait avant que sur montage. Voir lib/evenementsDonnees.ts.
  useEffect(() => ecouterDonneesModifiees("comportements", charger), [agentId]);

  function ouvrirEdition(c: Comportement) {
    setPanneau({ type: "edition", c });
    setTexteOuvert(c.texte);
    setNomOuvert(c.nom || "");
    setNomAuto(false); // un comportement existant a déjà un nom -> édition manuelle par défaut
    setErreurOuvert(null);
    // 22/08/2026, demande Bourama ("quand tu clique sur un skill existant,
    // tu vois le skill généré et l'aperçu, pas le texte ni le code en
    // premier") : ouverture directe sur l'onglet "skill" + sous-vue
    // "Aperçu" (rendu Markdown lisible), plutôt que sur le texte brut de
    // l'étudiant ou le markdown source du skill. Le chargement se fait ici
    // via chargerSkill(c) (même logique que ouvrirOngletSkill, dupliquée
    // car cette fonction n'a pas encore accès à `panneau` mis à jour par
    // le setPanneau ci-dessus -- setState est asynchrone).
    setOnglet("skill");
    setSkillOuvert("");
    setErreurSkill(null);
    setSkillVue("apercu");
    setPublie(false);
    setErreurPublication(null);
    chargerSkill(c.id);
  }

  function ouvrirCreation() {
    setPanneau({ type: "creation" });
    setTexteOuvert("");
    setNomOuvert("");
    setNomAuto(true);
    setErreurOuvert(null);
    setOnglet("texte");
    setSkillOuvert("");
    setErreurSkill(null);
    setSkillVue("texte");
  }

  // 22/08/2026, demande Bourama : extrait de ouvrirOngletSkill pour être
  // réutilisable depuis ouvrirEdition (ouverture directe sur ce même
  // onglet au clic sur un skill existant, voir plus haut). Prend
  // directement l'id plutôt que de lire `panneau` -- `setPanneau` juste
  // au-dessus dans ouvrirEdition est asynchrone, `panneau` n'y est donc
  // pas encore à jour au moment de l'appel.
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

  async function ouvrirOngletSkill() {
    setOnglet("skill");
    if (!panneau || panneau.type !== "edition" || skillOuvert || skillChargement) return;
    chargerSkill(panneau.c.id);
  }

  async function enregistrerSkill() {
    if (!panneau || panneau.type !== "edition") return;
    const skillMd = skillOuvert.trim();
    if (!skillMd) return;
    setSkillEnregistrementEnCours(true);
    setErreurSkill(null);
    try {
      const maj = await modifierSkillComportement(agentId, panneau.c.id, skillMd);
      setListe((prec) => (prec || []).map((c) => (c.id === maj.id ? maj : c)));
    } catch (e) {
      setErreurSkill(messageErreur(e));
    } finally {
      setSkillEnregistrementEnCours(false);
    }
  }

  function fermer() {
    setPanneau(null);
  }

  async function detacher() {
    if (!panneau || panneau.type !== "edition") return;
    setDetachementEnCours(true);
    setErreurOuvert(null);
    try {
      const maj = await attacherComportement(agentId, panneau.c.id, null, null);
      setListe((prec) => (prec || []).map((c) => (c.id === maj.id ? maj : c)));
      setPanneau({ type: "edition", c: maj });
    } catch (e) {
      setErreurOuvert(messageErreur(e));
    } finally {
      setDetachementEnCours(false);
    }
  }

  async function enregistrer() {
    if (!panneau) return;
    const texte = texteOuvert.trim();
    if (!texte) return;

    const nom = nomAuto ? null : nomOuvert.trim() || null;

    if (panneau.type === "creation") {
      setEnregistrementEnCours(true);
      setErreurOuvert(null);
      try {
        const cree = await ajouterComportement(agentId, texte, nom);
        setListe((prec) => [...(prec || []), cree]);
        demarrerFermeture(fermer);
      } catch (e) {
        setErreurOuvert(messageErreur(e));
      } finally {
        setEnregistrementEnCours(false);
      }
      return;
    }

    if (texte === panneau.c.texte && nom === (panneau.c.nom || null)) {
      demarrerFermeture(fermer);
      return;
    }
    setEnregistrementEnCours(true);
    setErreurOuvert(null);
    try {
      const maj = await modifierComportement(agentId, panneau.c.id, texte, nom);
      setListe((prec) => (prec || []).map((c) => (c.id === panneau.c.id ? maj : c)));
      demarrerFermeture(fermer);
    } catch (e) {
      setErreurOuvert(messageErreur(e));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function supprimer() {
    if (!panneau || panneau.type !== "edition") return;
    setSuppressionEnCours(true);
    setErreurOuvert(null);
    try {
      await supprimerComportement(agentId, panneau.c.id);
      setListe((prec) => (prec || []).filter((c) => c.id !== panneau.c.id));
      demarrerFermeture(fermer);
    } catch (e) {
      setErreurOuvert(messageErreur(e));
      setSuppressionEnCours(false);
    }
  }

  async function toggleActif(c: Comportement, e: MouseEvent) {
    e.stopPropagation();
    if (actifEnCours) return;
    setActifEnCours(c.id);
    try {
      const maj = await activerDesactiverComportement(agentId, c.id, !c.actif);
      setListe((prec) => (prec || []).map((x) => (x.id === maj.id ? maj : x)));
    } catch {
      // Silencieux -- le toggle est optionnel/secondaire, une erreur ici
      // ne doit pas casser la liste ; l'état reste simplement inchangé.
    } finally {
      setActifEnCours(null);
    }
  }

  async function publier() {
    if (!panneau || panneau.type !== "edition") return;
    setPublicationEnCours(true);
    setErreurPublication(null);
    try {
      await publierComportement(agentId, panneau.c.id);
      setPublie(true);
    } catch (e) {
      setErreurPublication(messageErreur(e));
    } finally {
      setPublicationEnCours(false);
    }
  }

  if (sansCompte && vue === "mes-comportements") {
    return <CTACompteRequis texte="Crée un compte pour ajouter tes propres consignes perso à Clovis." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full gap-1 border-b border-dj-bordure">
        <button
          onClick={() => setVue("mes-comportements")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            vue === "mes-comportements"
              ? "border-dj-accent-1 text-dj-texte"
              : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Mes comportements
        </button>
        <button
          onClick={() => setVue("public")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            vue === "public"
              ? "border-dj-accent-1 text-dj-texte"
              : "border-transparent text-dj-texte-muet hover:text-dj-texte"
          }`}
        >
          Public
        </button>
      </div>

      {vue === "public" ? (
        <ComportementsPublics onActive={charger} />
      ) : liste === undefined ? (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-14 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      ) : (
        <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
          <p className="text-sm text-dj-texte-muet">
            Tes consignes perso pour Clovis, en plus de ce que ton enseignant a déjà mis en place. Tu peux en ajouter
            plusieurs, clique sur l&apos;une d&apos;elles pour l&apos;ouvrir en grand et la modifier tranquillement.
          </p>

          <button
            onClick={ouvrirCreation}
            className="flex w-fit items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface px-3 py-1.5 text-sm font-medium text-dj-texte transition-colors hover:border-dj-bordure-forte hover:bg-dj-surface-haute"
          >
            <Plus size={14} />
            Nouveau comportement
          </button>

      {liste.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrer par origine">
          {(
            [
              { valeur: "tous", libelle: "Tous", icone: null },
              { valeur: "crees", libelle: "Créés", icone: Sparkles },
              { valeur: "public", libelle: "Public", icone: Download },
              { valeur: "attaches", libelle: "Attachés", icone: Link2 },
              { valeur: "audits", libelle: "Audits", icone: ClipboardCheck },
            ] as const
          ).map(({ valeur, libelle, icone: Icone }) => {
            const compte = liste.filter((c) => correspondFiltre(c, valeur)).length;
            const actif = filtreOrigine === valeur;
            return (
              <button
                key={valeur}
                role="tab"
                aria-selected={actif}
                onClick={() => setFiltreOrigine(valeur)}
                disabled={valeur !== "tous" && compte === 0}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-40 ${
                  actif
                    ? "border-dj-accent-1 bg-dj-accent-1/10 text-dj-texte"
                    : "border-dj-bordure text-dj-texte-muet hover:border-dj-bordure-forte hover:text-dj-texte"
                }`}
              >
                {Icone && <Icone size={12} />}
                {libelle}
                <span className="text-[10px] text-dj-texte-muet">{compte}</span>
              </button>
            );
          })}
        </div>
      )}

      {liste.length === 0 && <p className="text-sm text-dj-texte-muet">Rien ici pour l&apos;instant.</p>}

      {liste.length > 0 && liste.filter((c) => correspondFiltre(c, filtreOrigine)).length === 0 && (
        <p className="text-sm text-dj-texte-muet">Aucun skill dans cette catégorie pour l&apos;instant.</p>
      )}

      {liste.length > 0 && filtreOrigine !== "audits" && (
        <div key={filtreOrigine} className="flex animate-dj-fade-in-rapide flex-wrap gap-2">
          {liste.filter((c) => correspondFiltre(c, filtreOrigine)).map((c) => (
            <ChipComportement key={c.id} c={c} onOuvrir={ouvrirEdition} onToggleActif={toggleActif} />
          ))}
        </div>
      )}

      {/* 22/08/2026, demande Bourama ("les audits regroupés par matière") :
          dans l'onglet Audits, "Vue d'ensemble" (skills liés à une matière
          entière ou au programme entier) toujours visible en premier, puis
          un groupe repliable par matière pour les skills liés à un
          chapitre précis -- sinon la liste (un skill par chapitre, donc
          potentiellement des dizaines) est illisible en vrac. */}
      {liste.length > 0 && filtreOrigine === "audits" && (
        <div key="audits" className="flex animate-dj-fade-in-rapide flex-col gap-4">
          {(() => {
            const audits = liste.filter((c) => correspondFiltre(c, "audits"));
            const vueEnsemble = audits.filter((c) => c.lien_type !== "chapitre");
            const parChapitre = audits.filter((c) => c.lien_type === "chapitre");
            const groupes = new Map<string, { nom: string; items: Comportement[] }>();
            for (const c of parChapitre) {
              const cle = c.matiere_id || "sans-matiere";
              const nom = c.matiere_nom || "Autres chapitres";
              if (!groupes.has(cle)) groupes.set(cle, { nom, items: [] });
              groupes.get(cle)!.items.push(c);
            }
            const groupesTries = [...groupes.entries()].sort((a, b) => a[1].nom.localeCompare(b[1].nom));

            return (
              <>
                {vueEnsemble.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-dj-texte-muet">Vue d&apos;ensemble</p>
                    <div className="flex flex-wrap gap-2">
                      {vueEnsemble.map((c) => (
                        <ChipComportement key={c.id} c={c} onOuvrir={ouvrirEdition} onToggleActif={toggleActif} />
                      ))}
                    </div>
                  </div>
                )}

                {groupesTries.map(([cle, groupe]) => {
                  const ouvert = groupesOuverts.has(cle);
                  return (
                    <div key={cle} className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          setGroupesOuverts((prec) => {
                            const suivant = new Set(prec);
                            if (suivant.has(cle)) suivant.delete(cle);
                            else suivant.add(cle);
                            return suivant;
                          })
                        }
                        className="flex w-fit items-center gap-1.5 text-xs font-medium text-dj-texte-muet transition-colors hover:text-dj-texte"
                      >
                        {ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {groupe.nom}
                        <span className="text-[10px] text-dj-texte-muet">{groupe.items.length}</span>
                      </button>
                      {ouvert && (
                        <div className="flex animate-dj-fade-in-rapide flex-wrap gap-2 pl-1">
                          {groupe.items.map((c) => (
                            <ChipComportement key={c.id} c={c} onOuvrir={ouvrirEdition} onToggleActif={toggleActif} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      <ComportementsRecus />
        </div>
      )}

      {panneau && (
        <PanneauFlottant
          large
          enSortie={enSortie}
          onFerme={
            enregistrementEnCours || suppressionEnCours || skillEnregistrementEnCours || detachementEnCours
              ? undefined
              : () => demarrerFermeture(fermer)
          }
          entete={
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-dj-texte">
                {panneau.type === "creation" ? "Nouveau skill" : "Modifier ce skill"}
              </span>
              <button
                onClick={() => demarrerFermeture(fermer)}
                disabled={enregistrementEnCours || suppressionEnCours || skillEnregistrementEnCours || detachementEnCours}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-dj-texte-muet transition-colors hover:bg-dj-surface-haute disabled:opacity-50"
              >
                <X size={14} /> Fermer
              </button>
            </div>
          }
        >
          <div className="mb-3 flex w-full flex-shrink-0 gap-1 border-b border-dj-bordure">
            <button
              onClick={() => setOnglet("texte")}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                onglet === "texte"
                  ? "border-dj-accent-1 text-dj-texte"
                  : "border-transparent text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              Texte
            </button>
            {panneau.type === "edition" && (
              <button
                onClick={ouvrirOngletSkill}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  onglet === "skill"
                    ? "border-dj-accent-1 text-dj-texte"
                    : "border-transparent text-dj-texte-muet hover:text-dj-texte"
                }`}
              >
                <FileCode2 size={14} />
                Voir le skill généré
              </button>
            )}
          </div>

          {onglet === "texte" ? (
            <>
              {panneau.type === "edition" && panneau.c.lien_libelle && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-xs text-dj-texte-muet">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={12} /> Attaché à : <span className="text-dj-texte">{panneau.c.lien_libelle}</span>
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
                  <input
                    type="checkbox"
                    checked={nomAuto}
                    onChange={(e) => setNomAuto(e.target.checked)}
                    className="accent-dj-accent-1"
                  />
                  Auto
                </label>
              </div>

              {panneau.type === "edition" && (
                <p className="pb-3 text-xs text-dj-texte-muet">
                  <span className="font-medium text-dj-texte-muet">Description envoyée au routeur :</span>{" "}
                  {panneau.c.description || "—"}
                </p>
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
                  {panneau.type === "edition" && (
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
                    <Check size={14} />{" "}
                    {enregistrementEnCours ? "Enregistrement…" : panneau.type === "creation" ? "Créer" : "Enregistrer"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-2">
                <p className="text-xs text-dj-texte-muet">
                  Ce que l&apos;IA lit vraiment quand elle consulte ce comportement. Tu peux le corriger directement
                  ici -- si tu réédites le texte brut plus tard, il sera régénéré et remplacera ce que tu écris ici.
                </p>
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
                <div className="w-full flex-1 overflow-y-auto rounded-xl border border-dj-bordure bg-dj-surface-haute px-5 py-4">
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
        </PanneauFlottant>
      )}
    </div>
  );
}
