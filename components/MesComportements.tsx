"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Plus, ScrollText, Link2, ToggleLeft, ToggleRight, Download, Sparkles } from "lucide-react";
import { lireMesComportements, activerDesactiverComportement, type Comportement } from "@/lib/api";
import { ecouterDonneesModifiees } from "@/lib/evenementsDonnees";
import { ErreurApi } from "@/lib/erreurs";
import { useFermetureAnimee } from "@/lib/useFermetureAnimee";
import { CTACompteRequis } from "@/components/CTACompteRequis";
import { ComportementsRecus } from "@/components/ComportementsRecus";
import { ComportementsPublics } from "@/components/ComportementsPublics";
import { PanneauFlottant } from "@/components/PanneauFlottant";
import { EditeurComportement } from "@/components/EditeurComportement";
import { Skeleton } from "./Skeleton";
import { OngletsSegment } from "./OngletsSegment";
import { useInfoSection } from "./SectionPage";
import { BulleSurvol } from "./BulleSurvol";

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
        {/* Nom = déclencheur direct de la bulle de description au survol/clic
            (09/09/2026, retour final Bourama : "les skill reste inchangé
            avec description qui s'affiche au survol pas de i à côté de
            lui" -- annule le passage par un bouton "i" dédié essayé entre
            temps). revelerAuClic=false : le clic sur cette pilule ouvre
            déjà l'édition du skill (onOuvrir sur le bouton parent), la
            bulle ne doit pas lui voler ce clic -- seul le survol la révèle
            ici (le clic reste géré par le bouton parent). */}
        <div className="min-w-0 flex-1">
          <BulleSurvol texte={c.description || "(pas de description)"} className="truncate text-sm text-dj-texte" revelerAuClic={false}>
            {c.nom || c.description}
          </BulleSurvol>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => onToggleActif(c, e)}
          title={c.actif ? "Désactiver (ne sera plus proposé à l'IA)" : "Activer"}
          className="flex flex-shrink-0 items-center text-dj-texte-muet hover:text-dj-texte disabled:opacity-40"
        >
          {c.actif ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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

  // Description fixe remplacée par le bouton "i" du titre de page,
  // différente selon l'onglet ouvert (voir lib/aideSections.tsx,
  // rubriques "mes-skills" / "skills-publics") -- correctif 02/09/2026,
  // suite audit Bourama.
  useInfoSection(vue === "public" ? "skills-publics" : "mes-skills");

  // 22/08/2026, demande Bourama : distinguer les origines d'un skill
  // (créé directement / téléchargé du public) par des onglets-filtres
  // au-dessus de la liste. Non exclusif par design (confirmé par
  // Bourama).
  //
  // Pas de mécanisme i18n branché sur ce composant -- libellés en
  // français en dur comme le reste du fichier, à signaler à Bourama si
  // la traduction doit être ajoutée plus tard.
  type FiltreOrigine = "tous" | "crees" | "public";
  const [filtreOrigine, setFiltreOrigine] = useState<FiltreOrigine>("tous");

  function correspondFiltre(c: Comportement, f: FiltreOrigine): boolean {
    switch (f) {
      case "tous":
        return true;
      case "crees":
        return !c.depuis_public;
      case "public":
        return c.depuis_public;
    }
  }

  // Toggle actif/inactif par comportement (21/08, demande Bourama :
  // "ajoute activer et désactiver aux comportements") -- suivi par id
  // pour désactiver juste le bouton concerné pendant l'appel, sans
  // bloquer toute la liste.
  const [actifEnCours, setActifEnCours] = useState<string | null>(null);

  // Panneau plein écran : soit édition d'un comportement existant, soit
  // création d'un nouveau (07/08/2026, demande Bourama : "le mode plein
  // écran ne doit pas être dispo que pour ceux qui existent -- en mode
  // édition [ajout] il faut aussi un truc à côté de la ligne de champ").
  // Depuis le 18/08 (voir plus haut), c'est le SEUL chemin de création,
  // plus de raccourci en parallèle. 12/09/2026 : le contenu du panneau
  // (texte/skill/codes, tous les états qui vont avec) est désormais
  // extrait dans EditeurComportement.tsx (chantier "Mes codes = un vrai
  // éditeur") -- ce composant-ci ne garde que la décision d'ouvrir/fermer
  // et le mode (création vs édition de quel comportement).
  const [panneau, setPanneau] = useState<{ type: "edition"; c: Comportement } | { type: "creation" } | null>(null);
  const [sansCompte, setSansCompte] = useState(false);
  // Reflète l'état interne d'EditeurComportement (enregistrement/
  // suppression en cours) pour désactiver la fermeture par clic sur le
  // fond/Echap pendant ce temps -- même garde-fou qu'avant l'extraction.
  const [actionPanneauEnCours, setActionPanneauEnCours] = useState(false);

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
  }

  function ouvrirCreation() {
    setPanneau({ type: "creation" });
  }

  function fermer() {
    setPanneau(null);
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

  if (sansCompte && vue === "mes-comportements") {
    return <CTACompteRequis texte="Crée un compte pour ajouter tes propres consignes perso à Clovis." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Onglets passés en composant partagé OngletsSegment le 31/08/2026,
          voir OngletsSegment.tsx (fini le pattern soulignement web). */}
      <OngletsSegment
        ariaLabel="Section des comportements"
        valeur={vue}
        onChange={(v) => setVue(v as typeof vue)}
        onglets={[
          { valeur: "mes-comportements", libelle: "Mes comportements" },
          { valeur: "public", libelle: "Public" },
        ]}
      />

      {vue === "public" ? (
        <ComportementsPublics onActive={charger} />
      ) : liste === undefined ? (
        /* Skeleton précis (30/08, audit) : le vrai contenu n'est pas une
           liste de lignes pleine largeur mais des PILULES qui s'enroulent
           (flex-wrap) -- rounded-full, icône 14px + nom + interrupteur
           18px -- précédées du texte d'intro et du bouton "Nouveau
           comportement". L'ancien skeleton (2 blocs rectangulaires
           pleins) ne ressemblait à aucun des deux. */
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-4/5 rounded" style={{ animationDelay: "80ms" }} />
          </div>
          <Skeleton className="h-9 w-44 rounded-full border border-dj-bordure" style={{ animationDelay: "160ms" }} />
          <div className="flex flex-wrap gap-2">
            {[
              { largeur: 128, delai: "0ms" },
              { largeur: 176, delai: "60ms" },
              { largeur: 96, delai: "120ms" },
              { largeur: 224, delai: "180ms" },
              { largeur: 144, delai: "240ms" },
              { largeur: 112, delai: "300ms" },
              { largeur: 152, delai: "360ms" },
              { largeur: 88, delai: "420ms" },
              { largeur: 208, delai: "480ms" },
              { largeur: 120, delai: "540ms" },
              { largeur: 168, delai: "600ms" },
              { largeur: 104, delai: "660ms" },
              { largeur: 184, delai: "720ms" },
              { largeur: 136, delai: "780ms" },
            ].map(({ largeur, delai }, i) => (
              <div
                key={i}
                style={{ width: `${largeur}px` }}
                className="flex items-center gap-2 rounded-full border border-dj-bordure bg-dj-surface px-3.5 py-2"
              >
                <Skeleton className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ animationDelay: delai }} />
                <Skeleton className="h-3.5 flex-1 rounded" style={{ animationDelay: delai }} />
                <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded-full" style={{ animationDelay: delai }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex animate-dj-fade-in-rapide flex-col gap-4">
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

      {liste.length > 0 && (
        <div key={filtreOrigine} className="flex animate-dj-fade-in-rapide flex-wrap gap-2">
          {liste.filter((c) => correspondFiltre(c, filtreOrigine)).map((c) => (
            <ChipComportement key={c.id} c={c} onOuvrir={ouvrirEdition} onToggleActif={toggleActif} />
          ))}
        </div>
      )}

      <ComportementsRecus />
        </div>
      )}


      {panneau && (
        <PanneauFlottant
          large
          enSortie={enSortie}
          onFerme={actionPanneauEnCours ? undefined : () => demarrerFermeture(fermer)}
        >
          <EditeurComportement
            agentId={agentId}
            comportement={panneau.type === "edition" ? panneau.c : null}
            onFermer={() => demarrerFermeture(fermer)}
            onCree={(c) => setListe((prec) => [...(prec || []), c])}
            onModifie={(c) => setListe((prec) => (prec || []).map((x) => (x.id === c.id ? c : x)))}
            onSupprime={(id) => setListe((prec) => (prec || []).filter((x) => x.id !== id))}
            onActionEnCoursChange={setActionPanneauEnCours}
          />
        </PanneauFlottant>
      )}
    </div>
  );
}
