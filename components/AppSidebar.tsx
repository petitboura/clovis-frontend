"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFenetres } from "@/lib/contexteFenetres";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LogOut,
  LogIn,
  Home,
  Briefcase,
  ScrollText,
  Library,
  Brain,
  MoreHorizontal,
  Share2,
  Star,
  Compass,
  Plug,
  MessageSquarePlus,
  History,
  PanelLeft,
  Settings,
  Wand2,
  Hourglass,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lireMonProfil } from "@/lib/api";
import { NoteAgent } from "@/components/NoteAgent";
import { CommentairesAgent } from "@/components/CommentairesAgent";
import { BoutonInstaller } from "@/components/BoutonInstaller";
import { BlocsMenuPlus, SECTIONS_BASE } from "@/components/EspacePlus";
import { useFermerChat } from "@/lib/contexteChat";

// Nav principale de l'app (refonte "Mon espace = l'app", 15/08/2026,
// demande Bourama : "faut changer l'affichage même de mon espace, son
// architecture elle-même ; c'est plus une page, c'est elle l'appli").
// Remplace SidebarChatLite.tsx comme point d'entrée -- dérivée de ce même
// fichier (rail collapse/expand, panneau plein écran mobile, transitions),
// mais pointe vers de vraies routes (/bureau, /comportements, ...) au
// lieu d'un onglet en state local dans EspaceClovis.tsx, et sans les
// éléments propres au fil de conversation (historique, nouvelle
// conversation), qui vivent désormais dans ChatFlottant.tsx.
//
// Tous les onglets restent visibles pour tout le monde, connecté ou non
// (même principe que l'ancienne sidebar, 09/08 : "tout est visible") --
// SAUF que la navigation elle-même n'est plus interceptée pour un
// visiteur sans compte (contrairement à l'ancien clicMonEspace) : chaque
// section gère désormais elle-même son propre CTA "Crée un compte" en
// cas de 401 (voir CTACompteRequis.tsx), pour que l'invité "atterrisse
// sur Mon espace comme un compte connecté, avec limitations" (demande
// explicite Bourama).
//
// Un seul mouvement de survol pour toute la nav principale (refonte
// accueil/sidebar, 22/08/2026, demande Bourama : "corrige tout, même la
// logique d'affichage si besoin"). Remplace les 9 mouvements différents
// d'origine (16/08, "d'autres bougent même, d'autres se penchent sur le
// côté") : avec 9 sections dans le rail, 9 gestes différents ne se
// lisaient plus comme de la personnalité mais comme du bruit, l'oeil ne
// peut pas retenir "quelle icône fait quel mouvement", donc l'effet
// perçu était juste de l'agitation. Un seul geste cohérent laisse le
// fond (bg-dj-surface-haute) faire le travail de repère distinctif sur
// l'onglet actif (28/08/2026 : trait signature doré sous l'onglet actif
// retiré à la demande de Bourama, ne reste que ce fond). Les icônes
// contextuelles avec un sens propre (chevrons, boussole "Pourquoi
// Clovis ?") gardent leur mouvement dédié, gardé tel quel plus bas :
// seule la nav principale (accueil + 8 onglets) est uniformisée ici.

const AGENT_ID = "clovis";

// Type repris à l'identique de ChatFlottant.tsx (même convention que le
// reste du projet : pas de type partagé pour ça, chaque fichier qui en
// a besoin le redéclare localement).
type FilConversation = {
  conversation_id: string | null;
  titre: string;
  derniere_activite: string;
};

export type OngletId =
  | "bureau"
  | "comportements"
  | "bibliotheque"
  | "memoire"
  | "claude"
  | "controle-session";

export const ONGLETS: { id: OngletId; href: string; label: string; Icone: typeof Briefcase }[] = [
  { id: "bureau", href: "/bureau", label: "Bureau", Icone: Briefcase },
  // Texte affiché "Mes skills" (21/08/2026, demande Bourama) : en
  // interne (route, code, BDD, outils MCP) ça reste "comportement",
  // voir la note dans lib/api.ts. Seul le mot vu par l'utilisateur change.
  { id: "comportements", href: "/comportements", label: "Mes skills", Icone: ScrollText },
  { id: "bibliotheque", href: "/bibliotheque", label: "Bibliothèque", Icone: Library },
  { id: "memoire", href: "/memoire", label: "Ma mémoire", Icone: Brain },
  // Guide "Utiliser Clovis dans Claude" (18/08, demande Bourama) :
  // icône Plug ("branchement", demande explicite Bourama) plutôt que le
  // logo Claude, propriété d'Anthropic.
  { id: "claude", href: "/connecter-claude", label: "Utiliser Clovis dans Claude", Icone: Plug },
  // 30/08/2026, audit navigation web mobile vs natif, étape 2 : Concentration
  // (Contrôle de session + Temps d'écran, voir EspaceConcentration.tsx)
  // était un onglet direct côté natif et web mobile mais totalement
  // inatteignable sur PC (signalé par Bourama comme écran orphelin).
  // Ajouté ici pour que le PC ait, au minimum, le même accès de
  // consultation que les deux autres plateformes.
  { id: "controle-session", href: "/controle-session", label: "Concentration", Icone: Hourglass },
];

// Regroupement du rail par similarité d'usage (refonte sidebar,
// 22/08/2026, demande Bourama : "chaque section n'a pas forcément un
// bouton dédié, c'est peut-être un bouton qui ouvre une liste de cette
// catégorie", même esprit que la page Paramètres). Bureau, Bibliothèque
// et Notes restent en accès direct (usage quotidien). Mes skills et Ma
// mémoire sont regroupés sous "Personnaliser Clovis" (les façons de
// configurer ce que Clovis sait/fait). "Utiliser Clovis dans Claude" est
// un guide de configuration ponctuel, il descend dans le menu "Plus"
// plutôt que d'occuper un bouton du rail.
type Groupe = { id: string; href: string; label: string; Icone: typeof Briefcase; ongletIds: OngletId[] };
const GROUPES: Groupe[] = [
  { id: "personnaliser", href: "/personnaliser", label: "Personnaliser Clovis", Icone: Wand2, ongletIds: ["comportements", "memoire"] },
];

// Rotation des mouvements pour les icônes de nav (Accueil + les 7
// onglets) -- volontairement variés pour ne pas retomber sur un effet
// uniforme. Même assignation utilisée en desktop et mobile (calculée par
// index) pour que chaque section garde toujours le même mouvement.
const MOUVEMENT_NAV = "group-hover:translate-x-0.5";

function LibelleRail({ ouverte, children }: { ouverte: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap text-sm transition-[max-width,opacity] duration-300 ease-out ${
        ouverte ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
      }`}
    >
      {children}
    </span>
  );
}

// Menu déroulant ouvert au clic sur la photo de profil, en bas de la
// sidebar (22/08/2026, correctif demande Bourama : un clic sur la photo
// ne doit PAS naviguer directement, il doit ouvrir un petit menu -- même
// pattern que Slack/Discord/Notion, et même mécanique de popover que le
// menu "Actions" juste au dessus dans ce fichier : ref + état booléen +
// fermeture au clic extérieur, popover ancré juste au dessus du bouton).
function MenuProfil({
  avatarUrl,
  nomAffiche,
  ouverte,
  LibelleRail,
  mobile = false,
  menuOuvert,
  onBasculerMenu,
  onFermerMenu,
  onNaviguerVersParametres,
  onSeDeconnecter,
}: {
  avatarUrl: string | null;
  nomAffiche: string | null;
  ouverte: boolean;
  LibelleRail: React.ComponentType<{ ouverte: boolean; children: React.ReactNode }>;
  mobile?: boolean;
  // État du popup remonté à AppSidebar (24/08/2026, correctif demande
  // Bourama : le popup s'affichait masqué/coupé) -- avant, ce menu
  // gérait son ouverture tout seul en interne (useState local), donc
  // AppSidebar ne savait jamais qu'il fallait repasser le rail en
  // overflow-visible pendant que ce popup est ouvert. Même mécanique
  // que le menu "Actions" un peu plus haut dans ce fichier, qui avait
  // eu exactement ce problème le 20/08.
  menuOuvert: boolean;
  onBasculerMenu: () => void;
  onFermerMenu: () => void;
  onNaviguerVersParametres: () => void;
  onSeDeconnecter: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const libelle = nomAffiche || "Mon compte";

  useEffect(() => {
    if (!menuOuvert) return;
    function onClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermerMenu();
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
  }, [menuOuvert, onFermerMenu]);

  const Avatar = (
    <span className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-dj-bordure bg-dj-surface-haute">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar_url vient de Supabase Storage, hôte dynamique
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-dj-texte-muet">
          {libelle.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );

  return (
    <div ref={ref} className={`relative w-full ${mobile ? "" : "mt-2"}`}>
      <button
        onClick={onBasculerMenu}
        className={`group flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte ${
          mobile ? "px-2" : ""
        }`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">{Avatar}</span>
        {mobile ? <span className="text-sm">{libelle}</span> : <LibelleRail ouverte={ouverte}>{libelle}</LibelleRail>}
      </button>

      {menuOuvert && (
        <div
          className={`absolute bottom-full z-50 mb-2 w-56 animate-dj-fade-in-rapide overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
            mobile ? "left-2" : "left-0"
          }`}
        >
          <button
            onClick={() => {
              onFermerMenu();
              onNaviguerVersParametres();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-dj-surface-haute"
          >
            {Avatar}
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-dj-texte">{libelle}</span>
              <span className="text-xs text-dj-texte-muet">Voir le profil</span>
            </div>
          </button>

          <div className="border-t border-dj-bordure" />

          <button
            onClick={() => {
              onFermerMenu();
              onNaviguerVersParametres();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
          >
            <Settings size={16} className="text-dj-texte-muet" />
            Paramètres
          </button>

          <ThemeToggle LibelleRail={LibelleRail} ouverte />

          <div className="border-t border-dj-bordure" />

          <button
            onClick={() => {
              onFermerMenu();
              onSeDeconnecter();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--dj-erreur)] transition-colors hover:bg-dj-surface-haute"
          >
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

// Bouton de groupe (refonte sidebar, 22/08/2026, demande Bourama) :
// remplace un bloc de 2-3 boutons de rail dédiés par UN SEUL bouton qui
// ouvre un petit popup listant les sections du groupe, même principe que
// MenuProfil juste au-dessus. Contrôlé depuis AppSidebar (via `ouvert` /
// `onBasculer` / `onFermer`) pour que le conteneur du rail sache quand
// passer en overflow-visible, exactement comme pour "Historique" et
// "Plus".
function MenuGroupe({
  groupe,
  mobile = false,
  ouverte,
  LibelleRail,
  pathname,
  contexteChat,
  ouvrirFenetre,
  ouvert,
  onOuvrir,
  onFermer,
  onBasculer,
  onNaviguer,
}: {
  groupe: Groupe;
  mobile?: boolean;
  ouverte: boolean;
  LibelleRail: React.ComponentType<{ ouverte: boolean; children: React.ReactNode }>;
  pathname: string;
  contexteChat: boolean;
  ouvrirFenetre: (id: OngletId) => void;
  ouvert: boolean;
  onOuvrir: () => void;
  onFermer: () => void;
  onBasculer: () => void;
  onNaviguer?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const membres = ONGLETS.filter((o) => groupe.ongletIds.includes(o.id));
  const actif = membres.some((o) => pathname === o.href) || pathname === groupe.href;

  useEffect(() => {
    if (!ouvert) return;
    function onClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
  }, [ouvert, onFermer]);

  return (
    <div
      ref={ref}
      className={`relative w-full ${mobile ? "" : "mt-2"}`}
      onMouseEnter={() => !mobile && onOuvrir()}
      onMouseLeave={() => !mobile && onFermer()}
    >
      {/* Le bouton principal est un vrai lien (22/08/2026, demande
          Bourama : "les pages c'était quand tu clique sur la section ou
          la sous-section, le popup reste au survol"). En navigation
          normale, cliquer navigue vraiment vers la page du groupe. En
          chat plein écran, il n'y a pas de fenêtre flottante "groupe"
          à ouvrir : le clic bascule juste le popup, comme avant. */}
      <Link
        href={groupe.href}
        onClick={(e) => {
          if (contexteChat) {
            e.preventDefault();
            onBasculer();
          } else {
            onFermer();
            onNaviguer?.();
          }
        }}
        className={`group flex w-full items-center gap-2 rounded-xl transition-colors ${
          actif ? "text-dj-accent-1-texte" : ouvert ? "text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
        } ${mobile ? "px-2 py-2" : ""}`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <groupe.Icone size={18} className={`transition-transform duration-200 ${MOUVEMENT_NAV}`} />
        </span>
        {mobile ? <span className="text-sm">{groupe.label}</span> : <LibelleRail ouverte={ouverte}>{groupe.label}</LibelleRail>}
      </Link>

      {ouvert && (
        <div
          className={`absolute z-50 w-56 animate-dj-fade-in-rapide overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
            mobile ? "left-2 top-full mt-1" : "left-0 top-11"
          }`}
        >
          {membres.map((o) => {
            const estActif = pathname === o.href;
            return (
              <Link
                key={o.href}
                href={o.href}
                onClick={(e) => {
                  onFermer();
                  onNaviguer?.();
                  if (contexteChat) {
                    e.preventDefault();
                    ouvrirFenetre(o.id);
                  }
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  estActif ? "text-dj-accent-1-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                }`}
              >
                <o.Icone size={16} className="flex-shrink-0" />
                {o.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppSidebar({
  connecte,
  onOuvrirCatalogue,
  contexteChat = false,
  historique = [],
  conversationActiveId = null,
  aDesMessages = false,
  onNouvelleConversation,
  onSelectionnerConversation,
  masquerChromeMobile = false,
}: {
  connecte: boolean;
  // Ajouté le 26/08/2026, Bourama : refonte navigation mobile native
  // (@capgo/capacitor-native-navigation, voir components/mobile/
  // BarreOngletsNative.tsx). Sur l'appli Capacitor, le hamburger + tiroir
  // ci-dessous (pensés pour un site responsive) sont remplacés par la
  // vraie barre d'onglets système -- les afficher en plus créerait une
  // double navigation. Ne change RIEN au rail desktop (md:flex), qui
  // reste géré uniquement par la largeur d'écran comme avant. false par
  // défaut : le web garde exactement le même comportement qu'avant.
  masquerChromeMobile?: boolean;
  // "Pourquoi Clovis ?" -- géré au niveau du layout (AppShell.tsx), pas
  // ici, pour pouvoir s'ouvrir aussi automatiquement à la première
  // visite (même logique que l'ancien app/page.tsx, 14/08).
  onOuvrirCatalogue: () => void;
  // Contexte "chat en plein écran" (21/08/2026, demande Bourama : "il
  // faut qu'il soit la barre latérale de l'app avec les deux nouveaux
  // boutons rien d'autre" -- remplace RailChatPleinEcran.tsx, supprimé).
  // Cette même AppSidebar est montée une 2e fois (instance dupliquée,
  // demande explicite) DANS ChatFlottant.tsx quand le chat est en plein
  // écran, avec contexteChat=true : ajoute Nouvelle conversation +
  // Historique sur le rail, et déplace Ma mémoire + Audits (les moins
  // utiles en plein milieu d'une conversation) dans le dropdown Actions
  // pour compenser la place prise -- rien d'autre ne change. Hors chat
  // (contexteChat=false, valeur par défaut), AppSidebar reste identique
  // à avant.
  contexteChat?: boolean;
  historique?: FilConversation[];
  conversationActiveId?: string | null;
  aDesMessages?: boolean;
  onNouvelleConversation?: () => void;
  onSelectionnerConversation?: (fil: FilConversation) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const fermerChat = useFermerChat();
  // 22/08/2026, demande Bourama : remplace le comportement précédent
  // (fermer le chat plein écran au clic sur une section, cf. commit du
  // même jour) -- désormais le clic ouvre la section dans une fenêtre
  // flottante PAR-DESSUS le chat plein écran, qui reste ouvert. Voir
  // lib/contexteFenetres.tsx + components/chat/FenetresSections.tsx.
  // Seulement en contexteChat=true (l'autre instance, hors chat, garde
  // sa vraie navigation classique par route).
  const { ouvrir: ouvrirFenetre } = useFenetres();
  const [ouverte, setOuverte] = useState(false);
  const [actionsDeplie, setActionsDeplie] = useState(false);
  const [groupeOuvertId, setGroupeOuvertId] = useState<string | null>(null);
  const [avisDeplie, setAvisDeplie] = useState(false);
  const [copie, setCopie] = useState(false);
  const [historiqueDeplie, setHistoriqueDeplie] = useState(false);
  // Popup du menu profil (24/08/2026, correctif demande Bourama : voir
  // commentaire dans MenuProfil plus haut). Remonté ici pour piloter le
  // overflow-visible du rail, comme actionsDeplie/historiqueDeplie/groupeOuvertId.
  const [profilDeplie, setProfilDeplie] = useState(false);
  const asideRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Photo + nom affichés en bas de la sidebar (22/08/2026, demande
  // Bourama : "la photo de profil s'affiche en bas dans la sidebar et
  // est un bouton") -- remplace le bloc "Logo Clovis" non cliquable qui
  // s'y trouvait, uniquement pour un utilisateur connecté (rien à
  // afficher pour un visiteur, voir rendu plus bas). Chargé ici (jamais
  // remonté à AppShell, qui ne connaît que le booléen `connecte`) car
  // c'est le seul endroit de l'app qui en a besoin.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nomAffiche, setNomAffiche] = useState<string | null>(null);

  useEffect(() => {
    if (!connecte) {
      setAvatarUrl(null);
      setNomAffiche(null);
      return;
    }
    let annule = false;
    lireMonProfil()
      .then((p: { avatar_url: string | null; nom_affiche: string }) => {
        if (annule) return;
        setAvatarUrl(p.avatar_url || null);
        setNomAffiche(p.nom_affiche || null);
      })
      .catch(() => {
        // Best-effort : l'initiale de repli ("Mon compte") suffit si ce
        // chargement échoue, pas la peine d'afficher une erreur ici.
      });
    return () => {
      annule = true;
    };
  }, [connecte]);

  function basculerActions() {
    setActionsDeplie((v) => !v);
  }

  // Dropdown "Actions" (20/08/2026, demande Bourama : la barre latérale
  // étant quasi pleine, l'ancien accordéon poussait le sélecteur de
  // thème et "Se déconnecter" hors du cadre visible, coupés par
  // l'overflow-hidden du rail) -- petit menu flottant collé au bouton
  // plutôt qu'un dépli qui repousse le reste de la colonne. Se ferme au
  // clic en dehors.
  useEffect(() => {
    if (!actionsDeplie) return;
    function onClicExterieur(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsDeplie(false);
      }
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
  }, [actionsDeplie]);

  // Corrigé le 31/08/2026, Bourama : partageait window.location.origin,
  // qui vaut "https://localhost" dans l'app mobile Capacitor (la WebView
  // sert le site depuis un serveur local interne, pas le vrai domaine),
  // donc le lien partagé/copié était inutilisable. On partage maintenant
  // le vrai lien de téléchargement de l'app (page /telecharger, voir
  // app/telecharger/page.tsx), construit à partir de NEXT_PUBLIC_APP_URL
  // (fixe, correct sur toutes les plateformes, web ET mobile).
  async function partager() {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/telecharger`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Télécharger Clovis", url });
      } catch {
        // Annulé par la personne.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", url);
    }
  }

  async function seDeconnecter() {
    if (!connecte) {
      window.location.href = "/connexion";
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/connexion";
  }

  function LienOnglet({
    onglet,
    mouvement,
    mobile = false,
    actifSupplementaire = false,
  }: {
    onglet: { id?: OngletId; href: string; label: string; Icone: typeof Briefcase };
    mouvement: string;
    mobile?: boolean;
    /** Pour les liens de groupe (Personnaliser Clovis, Scolarité) : reste
     * actif tant qu'on est sur une des sections soeurs, pas seulement sur
     * la page d'atterrissage exacte du groupe (22/08/2026, demande
     * Bourama). */
    actifSupplementaire?: boolean;
  }) {
    const actif = pathname === onglet.href || actifSupplementaire;
    return (
      <Link
        href={onglet.href}
        onClick={(e) => {
          if (mobile) setOuverte(false);
          // En contexteChat=true, une vraie "section" (id présent --
          // "Accueil" n'en a pas, cf. navComplete plus bas, et garde sa
          // navigation classique) s'ouvre en fenêtre flottante par-dessus
          // le chat au lieu de naviguer.
          if (contexteChat && onglet.id) {
            e.preventDefault();
            ouvrirFenetre(onglet.id);
          }
        }}
        className={`group relative mt-2 flex w-full items-center gap-2 rounded-xl transition-colors ${
          actif ? "bg-dj-surface-haute text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
        } ${mobile ? "px-2" : ""}`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
          <onglet.Icone size={18} className={`transition-transform duration-200 ${mouvement}`} />
        </span>
        {mobile ? <span className="text-sm">{onglet.label}</span> : <LibelleRail ouverte={ouverte}>{onglet.label}</LibelleRail>}
      </Link>
    );
  }

  // Accès direct sur le rail : Bureau, Bibliothèque, Concentration (usage
  // quotidien). Mes skills, Ma mémoire et Plugins vivent sous le groupe
  // "Personnaliser Clovis" ; Mon programme et Audits sous "Scolarité"
  // (voir GROUPES plus haut). "Utiliser Clovis dans Claude" vit dans le
  // menu "Plus". En contexte chat plein écran, Bureau et Concentration
  // descendent aussi dans "Plus" (place prise par Nouvelle conversation +
  // Historique, élargi le 22/08/2026, demande Bourama) : même traitement
  // pour Concentration (30/08/2026, audit navigation, étape 2) que pour
  // Bureau, ajouté ce jour-là au rail desktop.
  const idsDirects: OngletId[] = contexteChat
    ? ["bibliotheque"]
    : ["bureau", "bibliotheque", "controle-session"];
  const idsPlusFlat: OngletId[] = contexteChat ? ["bureau", "controle-session", "claude"] : ["claude"];
  const ongletsDirects = ONGLETS.filter((o) => idsDirects.includes(o.id));
  const ongletsDansActions = ONGLETS.filter((o) => idsPlusFlat.includes(o.id));
  const navComplete = [{ href: "/", label: "Accueil", Icone: Home }, ...ongletsDirects];

  // 30/08/2026, demande Bourama : le tiroir mobile du chat (plus bas,
  // ouverte && !masquerChromeMobile) doit reprendre les mêmes 4 boutons
  // que la barre d'onglets mobile -- Bibliothèque, Concentration,
  // Bureau, Personnaliser Clovis (celui-ci via GROUPES, déjà rendu plus
  // bas, pas repris ici) -- sans Accueil (rejoint le "Plus" unifié) ni
  // Chat (on y est déjà). Mobile uniquement : ne touche pas
  // navComplete/idsDirects ci-dessus, qui restent la version desktop
  // inchangée (rendue ligne ~700).
  const ongletsMobileDirects = (["bibliotheque", "controle-session", "bureau"] as OngletId[])
    .map((id) => ONGLETS.find((o) => o.id === id))
    .filter((o): o is (typeof ONGLETS)[number] => Boolean(o));

  // Navigation depuis le "Plus" unifié du tiroir mobile (BlocsMenuPlus
  // + SECTIONS_BASE, voir plus bas) : "Connecter Claude" a un vrai id
  // de section (claude), donc s'ouvre en fenêtre flottante par-dessus
  // le chat comme les autres (même mécanique que LienOnglet). Les
  // autres (Accueil, Paramètres, Rappels) n'ont pas d'id de section
  // (pas de fenêtre flottante possible) : le chat doit d'abord se
  // fermer, sinon la page cible se charge derrière lui et reste
  // invisible (fixed inset-0 z-[110]).
  function naviguerDepuisPlusMobile(href: string) {
    setOuverte(false);
    if (href === "/connecter-claude") {
      ouvrirFenetre("claude");
      return;
    }
    fermerChat();
    router.push(href);
  }

  return (
    <>
      {ouverte && !masquerChromeMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOuverte(false)}
          aria-hidden="true"
        />
      )}

      {/* 30/08/2026, revu après le chantier hamburger natif/web (voir
          MenuHamburgerNatif.tsx) : cette instance-ci d'AppSidebar (chat
          plein écran, contexteChat=true, masquerChromeMobile=false)
          n'avait pas été touchée par ce chantier et gardait encore
          l'icône PanelLeft copiée du rail desktop (bouton "Replier le
          panneau" plus bas) sur fond noir arrondi. Remplacée par la même
          icône capsule que MenuHamburgerNatif/MenuHamburgerWeb pour la
          cohérence visuelle, même fond retiré, même couleur suivant le
          thème (text-dj-texte). Comportement au clic volontairement
          inchangé (Bourama : garder le tiroir latéral tel quel), donc
          `ouverte`/`setOuverte` et le tiroir plus bas ne sont pas
          touchés, seuls l'icône et le style du bouton changent. */}
      {!masquerChromeMobile && (
        <button
          onClick={() => setOuverte((v) => !v)}
          aria-label={ouverte ? "Replier le panneau" : "Déplier le panneau"}
          className="group fixed left-2 top-[calc(0.5rem+var(--safe-top))] z-40 flex h-8 w-8 items-center justify-center text-dj-texte md:hidden"
        >
          <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden="true" className="transition-transform duration-200 group-hover:scale-95">
            <rect x="3" y="6" width="18" height="3" rx="1.5" fill="currentColor" />
            <rect x="3" y="11" width="12" height="3" rx="1.5" fill="currentColor" />
            <rect x="3" y="16" width="6" height="3" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      )}

      <div
        ref={asideRef}
        className={`hidden flex-shrink-0 flex-col border-r border-dj-bordure bg-dj-fond px-2 py-3 transition-[width] duration-300 ease-out md:flex ${
          actionsDeplie || historiqueDeplie || groupeOuvertId || profilDeplie ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        } ${ouverte ? "md:w-72" : "md:w-14"}`}
      >
        <button
          onClick={() => setOuverte((v) => !v)}
          aria-label={ouverte ? "Replier le panneau" : "Déplier le panneau"}
          className="group flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <PanelLeft size={18} className="transition-transform duration-200 group-hover:scale-95" />
          </span>
          <LibelleRail ouverte={ouverte}>Replier</LibelleRail>
        </button>

        <div className="my-2 h-px w-full bg-dj-bordure" />

        {contexteChat && (
          <>
            {aDesMessages && (
              <button
                onClick={onNouvelleConversation}
                className="group flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                  <MessageSquarePlus size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-6" />
                </span>
                <LibelleRail ouverte={ouverte}>Nouvelle conversation</LibelleRail>
              </button>
            )}

            {historique.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setHistoriqueDeplie((v) => !v)}
                  className={`group flex w-full items-center gap-2 rounded-xl transition-colors ${
                    historiqueDeplie ? "text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                  }`}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                    <History size={18} className="transition-transform duration-300 group-hover:rotate-45" />
                  </span>
                  <LibelleRail ouverte={ouverte}>Historique</LibelleRail>
                </button>
                {historiqueDeplie && (
                  <div className="absolute left-1 top-11 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-xl border border-dj-bordure bg-dj-surface p-1 shadow-lg">
                    {historique.map((fil) => {
                      const estActive = fil.conversation_id === conversationActiveId;
                      return (
                        <button
                          key={fil.conversation_id ?? "legacy"}
                          onClick={() => !estActive && onSelectionnerConversation?.(fil)}
                          disabled={estActive}
                          className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                            estActive ? "text-dj-accent-1-texte" : "text-dj-texte hover:bg-dj-surface-haute"
                          }`}
                        >
                          {estActive ? "● " : ""}
                          {fil.titre}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="my-2 h-px w-full bg-dj-bordure" />
          </>
        )}

        {navComplete.map((o) => (
          <LienOnglet key={o.href} onglet={o} mouvement={MOUVEMENT_NAV} />
        ))}

        {GROUPES.map((g) => (
          <MenuGroupe
            key={g.id}
            groupe={g}
            ouverte={ouverte}
            LibelleRail={LibelleRail}
            pathname={pathname}
            contexteChat={contexteChat}
            ouvrirFenetre={ouvrirFenetre}
            ouvert={groupeOuvertId === g.id}
            onOuvrir={() => setGroupeOuvertId(g.id)}
            onFermer={() => setGroupeOuvertId((v) => (v === g.id ? null : v))}
            onBasculer={() => setGroupeOuvertId((v) => (v === g.id ? null : g.id))}
          />
        ))}

        {ouverte && (
          <div className="mt-auto flex justify-center pt-2">
            <BoutonInstaller />
          </div>
        )}

        <div ref={actionsRef} className={`relative rounded-xl ${ouverte ? "mt-2" : "mt-auto"}`}>
          <button
            onClick={basculerActions}
            title="Plus"
            className={`group flex w-full items-center gap-2 rounded-xl transition-colors ${
              actionsDeplie ? "text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
            }`}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
            </span>
            <LibelleRail ouverte={ouverte}>Plus</LibelleRail>
          </button>
          {actionsDeplie && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-64 animate-dj-fade-in-rapide rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-2">
                {ongletsDansActions.map((o) => {
                    const actif = pathname === o.href;
                    return (
                      <Link
                        key={o.href}
                        href={o.href}
                        onClick={(e) => {
                          setActionsDeplie(false);
                          if (contexteChat) {
                            e.preventDefault();
                            ouvrirFenetre(o.id);
                          }
                        }}
                        className={`group relative flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          actif ? "text-dj-accent-1-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                        }`}
                      >
                        <o.Icone size={16} className="flex-shrink-0" />
                        {o.label}
                      </Link>
                    );
                  })}

                <button
                  onClick={partager}
                  className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                >
                  <Share2 size={16} className="flex-shrink-0 transition-transform duration-200 group-hover:-rotate-12" />
                  {copie ? "Copié !" : "Partager"}
                </button>

                <div className="rounded-lg">
                  <button
                    onClick={() => setAvisDeplie((v) => !v)}
                    className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                      avisDeplie ? "text-dj-texte" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                    }`}
                  >
                    <Star size={16} className="flex-shrink-0 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
                    Avis sur Clovis
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      avisDeplie ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-col gap-4 px-2 pb-2">
                        <NoteAgent agentId={AGENT_ID} />
                        <CommentairesAgent agentId={AGENT_ID} />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOuvrirCatalogue}
                  className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                >
                  <Compass size={16} className="flex-shrink-0 transition-transform duration-300 group-hover:rotate-45" />
                  Pourquoi Clovis ?
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Thème et Se déconnecter/connecter (refonte sidebar,
            22/08/2026, demande Bourama : "enlève le bouton se
            déconnecter, thème"). Avant : ces deux actions apparaissaient
            en double, une fois ici comme boutons de rail à part entière,
            une fois dans MenuProfil juste en dessous. Elles restent
            disponibles (impossible de les supprimer, ce sont des actions
            essentielles), mais uniquement dans MenuProfil : c'est
            exactement le principe qu'on applique déjà aux 8 sections
            (un bouton qui ouvre une liste plutôt qu'un bouton par
            action). Pour un visiteur non connecté, MenuProfil n'existe
            pas : on garde un vrai bouton "Se connecter" à la place. */}
        {connecte ? (
          <MenuProfil
            avatarUrl={avatarUrl}
            nomAffiche={nomAffiche}
            ouverte={ouverte}
            LibelleRail={LibelleRail}
            menuOuvert={profilDeplie}
            onBasculerMenu={() => setProfilDeplie((v) => !v)}
            onFermerMenu={() => setProfilDeplie(false)}
            onNaviguerVersParametres={() => router.push("/parametres")}
            onSeDeconnecter={seDeconnecter}
          />
        ) : (
          <button
            onClick={seDeconnecter}
            className="group mt-2 flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <LogIn size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
            <LibelleRail ouverte={ouverte}>Se connecter</LibelleRail>
          </button>
        )}
      </div>

      {/* Panneau plein écran mobile, même logique que desktop -- masqué
          dans l'appli native, remplacé par BarreOngletsNative.tsx. */}
      {ouverte && !masquerChromeMobile && (
        <div
          className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-dj-bordure bg-dj-fond px-2 py-3 md:hidden ${
            profilDeplie ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
          }`}
        >
          <div className="mt-[calc(2rem+var(--safe-top))]">
            {contexteChat && (
              <>
                {aDesMessages && (
                  <button
                    onClick={onNouvelleConversation}
                    className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                  >
                    <MessageSquarePlus size={18} className="flex-shrink-0" />
                    <span className="text-sm">Nouvelle conversation</span>
                  </button>
                )}

                {historique.length > 0 && (
                  <div className="mt-1">
                    <button
                      onClick={() => setHistoriqueDeplie((v) => !v)}
                      className={`group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm transition-colors ${
                        historiqueDeplie ? "text-dj-texte" : "text-dj-texte-muet"
                      }`}
                    >
                      <History size={18} className="flex-shrink-0" />
                      Historique
                    </button>
                    {historiqueDeplie && (
                      <div className="flex max-h-56 flex-col overflow-y-auto px-1 pb-1">
                        {historique.map((fil) => {
                          const estActive = fil.conversation_id === conversationActiveId;
                          return (
                            <button
                              key={fil.conversation_id ?? "legacy"}
                              onClick={() => !estActive && onSelectionnerConversation?.(fil)}
                              disabled={estActive}
                              className={`truncate border-b border-white/[0.06] px-2 py-2 text-left text-sm last:border-b-0 ${
                                estActive ? "text-dj-accent-1-texte" : "text-dj-texte hover:text-dj-texte"
                              }`}
                            >
                              {estActive ? "● " : ""}
                              {fil.titre}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="my-2 h-px w-full bg-dj-bordure" />
              </>
            )}

            {ongletsMobileDirects.map((o) => (
              <LienOnglet key={o.href} onglet={o} mouvement={MOUVEMENT_NAV} mobile />
            ))}

            {GROUPES.map((g) =>
              contexteChat ? (
                <MenuGroupe
                  key={g.id}
                  groupe={g}
                  mobile
                  ouverte
                  LibelleRail={LibelleRail}
                  pathname={pathname}
                  contexteChat={contexteChat}
                  ouvrirFenetre={ouvrirFenetre}
                  ouvert={groupeOuvertId === g.id}
                  onOuvrir={() => setGroupeOuvertId(g.id)}
                  onFermer={() => setGroupeOuvertId((v) => (v === g.id ? null : v))}
                  onBasculer={() => setGroupeOuvertId((v) => (v === g.id ? null : g.id))}
                  onNaviguer={() => setOuverte(false)}
                />
              ) : (
                <LienOnglet
                  key={g.id}
                  onglet={{ href: g.href, label: g.label, Icone: g.Icone }}
                  mouvement={MOUVEMENT_NAV}
                  mobile
                  actifSupplementaire={g.ongletIds.some((id) => pathname === ONGLETS.find((o) => o.id === id)?.href)}
                />
              )
            )}
          </div>

          <div className="mt-2 flex justify-center">
            <BoutonInstaller />
          </div>

          {/* 30/08/2026, demande Bourama : "il n'y a qu'un plus" -- ce
              "Plus" reprenait avant son propre contenu (Bureau,
              Concentration, Claude, Partager, Avis, Pourquoi Clovis),
              divergent de celui du menu principal mobile (SECTIONS_BASE,
              voir EspacePlus.tsx). Bureau et Concentration ont rejoint
              les boutons directs juste au dessus (ongletsMobileDirects) ;
              pour le reste, ce bloc réutilise maintenant BlocsMenuPlus
              tel quel (même composant que MenuHamburgerNatif.tsx/
              MenuHamburgerWeb.tsx), pour ne plus jamais avoir deux
              listes "Plus" qui divergent. Corrige au passage Rappels,
              absent d'ici jusque là. onNaviguer personnalisé (voir plus
              haut) : nécessaire ici uniquement, pour gérer fenêtre
              flottante/fermeture du chat, contrairement aux deux autres
              appelants qui restent sur le router.push par défaut. */}
          <div className="mt-2 rounded-xl px-2">
            <button
              onClick={() => setActionsDeplie((v) => !v)}
              className={`group flex w-full items-center gap-2 py-2 text-sm transition-colors ${
                actionsDeplie ? "text-dj-texte" : "text-dj-texte-muet"
              }`}
            >
              <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
              Plus
            </button>
            {actionsDeplie && (
              <div className="pb-2">
                <BlocsMenuPlus sectionsNavigation={SECTIONS_BASE} onNaviguer={naviguerDepuisPlusMobile} />
              </div>
            )}
          </div>

          {/* Thème, profil et Se déconnecter/connecter regroupés dans
              MenuProfil (refonte sidebar, 22/08/2026, demande Bourama).
              Avant : 3 lignes séparées ici (Thème, lien profil, Se
              déconnecter) qui refaisaient à la main ce que MenuProfil
              fait déjà proprement côté desktop : c'est ce doublon qui
              faisait déborder le panneau mobile. */}
          <div className="mt-auto">
            {connecte ? (
              <MenuProfil
                avatarUrl={avatarUrl}
                nomAffiche={nomAffiche}
                ouverte
                LibelleRail={LibelleRail}
                mobile
                menuOuvert={profilDeplie}
                onBasculerMenu={() => setProfilDeplie((v) => !v)}
                onFermerMenu={() => setProfilDeplie(false)}
                onNaviguerVersParametres={() => {
                  setProfilDeplie(false);
                  setOuverte(false);
                  router.push("/parametres");
                }}
                onSeDeconnecter={seDeconnecter}
              />
            ) : (
              <button
                onClick={seDeconnecter}
                className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                  <LogIn size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
                <span className="text-sm">Se connecter</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
