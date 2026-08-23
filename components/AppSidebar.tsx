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
  BookOpen,
  Puzzle,
  ScanSearch,
  MoreHorizontal,
  Share2,
  Star,
  Compass,
  Plug,
  NotebookPen,
  MessageSquarePlus,
  History,
  PanelLeft,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lireMonProfil } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { NoteAgent } from "@/components/NoteAgent";
import { CommentairesAgent } from "@/components/CommentairesAgent";
import { BoutonInstaller } from "@/components/BoutonInstaller";

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
// trait signature (TraitSignature, sous l'onglet actif) faire le travail
// de repère distinctif, lui seul mérite d'être unique. Les icônes
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
  | "notes"
  | "memoire"
  | "programme"
  | "plugins"
  | "audits"
  | "claude";

export const ONGLETS: { id: OngletId; href: string; label: string; Icone: typeof Briefcase }[] = [
  { id: "bureau", href: "/bureau", label: "Bureau", Icone: Briefcase },
  // Texte affiché "Mes skills" (21/08/2026, demande Bourama) -- en
  // interne (route, code, BDD, outils MCP) ça reste "comportement",
  // voir la note dans lib/api.ts. Seul le mot vu par l'utilisateur change.
  { id: "comportements", href: "/comportements", label: "Mes skills", Icone: ScrollText },
  { id: "bibliotheque", href: "/bibliotheque", label: "Bibliothèque", Icone: Library },
  // Section "Notion-like" (Partie 2, lot 5/5, 20/08, demande Bourama) --
  // juste après Bibliothèque, thématiquement proche (contenu personnel
  // organisé par l'étudiant).
  { id: "notes", href: "/notes", label: "Notes", Icone: NotebookPen },
  { id: "memoire", href: "/memoire", label: "Ma mémoire", Icone: Brain },
  { id: "programme", href: "/programme", label: "Mon programme", Icone: BookOpen },
  { id: "plugins", href: "/plugins", label: "Plugins", Icone: Puzzle },
  { id: "audits", href: "/audits", label: "Audits", Icone: ScanSearch },
  // Guide "Utiliser Clovis dans Claude" (18/08, demande Bourama) --
  // icône Plug ("branchement", demande explicite Bourama) plutôt que le
  // logo Claude, propriété d'Anthropic.
  { id: "claude", href: "/connecter-claude", label: "Utiliser Clovis dans Claude", Icone: Plug },
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
  onNaviguerVersParametres,
  onSeDeconnecter,
}: {
  avatarUrl: string | null;
  nomAffiche: string | null;
  ouverte: boolean;
  LibelleRail: React.ComponentType<{ ouverte: boolean; children: React.ReactNode }>;
  mobile?: boolean;
  onNaviguerVersParametres: () => void;
  onSeDeconnecter: () => void;
}) {
  const [deplie, setDeplie] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const libelle = nomAffiche || "Mon compte";

  useEffect(() => {
    if (!deplie) return;
    function onClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDeplie(false);
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
  }, [deplie]);

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
        onClick={() => setDeplie((v) => !v)}
        className={`group flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte ${
          mobile ? "px-2" : ""
        }`}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">{Avatar}</span>
        {mobile ? <span className="text-sm">{libelle}</span> : <LibelleRail ouverte={ouverte}>{libelle}</LibelleRail>}
      </button>

      {deplie && (
        <div
          className={`absolute bottom-full z-50 mb-2 w-56 animate-dj-fade-in-rapide overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
            mobile ? "left-2" : "left-0"
          }`}
        >
          <button
            onClick={() => {
              setDeplie(false);
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
              setDeplie(false);
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
              setDeplie(false);
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

export function AppSidebar({
  connecte,
  onOuvrirCatalogue,
  contexteChat = false,
  historique = [],
  conversationActiveId = null,
  aDesMessages = false,
  onNouvelleConversation,
  onSelectionnerConversation,
}: {
  connecte: boolean;
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
  const [avisDeplie, setAvisDeplie] = useState(false);
  const [copie, setCopie] = useState(false);
  const [historiqueDeplie, setHistoriqueDeplie] = useState(false);
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

  async function partager() {
    const url = window.location.origin;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Clovis", url });
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
  }: {
    onglet: { id?: OngletId; href: string; label: string; Icone: typeof Briefcase };
    mouvement: string;
    mobile?: boolean;
  }) {
    const actif = pathname === onglet.href;
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
        {actif && <TraitSignature className="absolute bottom-0.5 left-2" />}
      </Link>
    );
  }

  // Élément signature (17/08, nouvelle direction "Nuit d'étude") : trait
  // à main levée (irrégulier, pas une ligne géométriquement parfaite --
  // même logique que le traitement "cgpt-*" du reste de l'app) sous
  // l'onglet de navigation actif, en accent doré. Remplace tout autre
  // indicateur d'état actif redondant -- volontairement discret, un seul
  // endroit, pas décoratif ailleurs.
  function TraitSignature({ className = "" }: { className?: string }) {
    return (
      <svg width="24" height="5" viewBox="0 0 24 5" className={className} aria-hidden="true">
        <path
          d="M0.5,2.6 C4,1.1 8,3.4 12,2 C16,0.7 20,3.1 23.5,1.8"
          stroke="var(--dj-accent-1)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // En contexte chat plein écran : Ma mémoire, Audits, Bureau, Plugins et
  // Utiliser Clovis dans Claude quittent le rail principal pour le
  // dropdown Actions (place prise par Nouvelle conversation + Historique,
  // voir prop contexteChat ci-dessus -- élargi le 22/08/2026, demande
  // Bourama).
  const ID_ONGLETS_DANS_ACTIONS: OngletId[] = ["memoire", "audits", "bureau", "plugins", "claude"];
  const ongletsRail = contexteChat
    ? ONGLETS.filter((o) => !ID_ONGLETS_DANS_ACTIONS.includes(o.id))
    : ONGLETS;
  const ongletsDansActions = contexteChat
    ? ONGLETS.filter((o) => ID_ONGLETS_DANS_ACTIONS.includes(o.id))
    : [];
  const navComplete = [{ href: "/", label: "Accueil", Icone: Home }, ...ongletsRail];

  return (
    <>
      {ouverte && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOuverte(false)}
          aria-hidden="true"
        />
      )}

      <button
        onClick={() => setOuverte((v) => !v)}
        aria-label={ouverte ? "Replier le panneau" : "Déplier le panneau"}
        className="group fixed left-2 top-2 z-40 flex h-8 w-8 items-center justify-center rounded-md bg-black/35 text-white hover:bg-black/50 md:hidden"
      >
        <PanelLeft size={16} className="transition-transform duration-200 group-hover:scale-95" />
      </button>

      <div
        ref={asideRef}
        className={`hidden flex-shrink-0 flex-col border-r border-dj-bordure bg-dj-fond px-2 py-3 transition-[width] duration-300 ease-out md:flex ${
          actionsDeplie || historiqueDeplie ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
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
                    historiqueDeplie ? "text-dj-accent-1" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
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
                            estActive ? "text-dj-accent-1" : "text-dj-texte hover:bg-dj-surface-haute"
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

        {ouverte && (
          <div className="mt-auto flex justify-center pt-2">
            <BoutonInstaller />
          </div>
        )}

        <div ref={actionsRef} className={`relative rounded-xl ${ouverte ? "mt-2" : "mt-auto"}`}>
          <button
            onClick={basculerActions}
            title="Actions"
            className={`group flex w-full items-center gap-2 rounded-xl transition-colors ${
              actionsDeplie ? "text-dj-accent-1" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
            }`}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
            </span>
            <LibelleRail ouverte={ouverte}>Actions</LibelleRail>
          </button>
          {actionsDeplie && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-64 animate-dj-fade-in-rapide rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-2">
                {contexteChat &&
                  ongletsDansActions.map((o) => {
                    const actif = pathname === o.href;
                    return (
                      <Link
                        key={o.href}
                        href={o.href}
                        onClick={(e) => {
                          setActionsDeplie(false);
                          e.preventDefault();
                          ouvrirFenetre(o.id);
                        }}
                        className={`group relative flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          actif ? "text-dj-accent-1" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                        }`}
                      >
                        <o.Icone size={16} className="flex-shrink-0" />
                        {o.label}
                        {actif && <TraitSignature className="absolute bottom-0.5 left-2" />}
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
                      avisDeplie ? "text-dj-accent-1" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
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

        <ThemeToggle LibelleRail={LibelleRail} ouverte={ouverte} />

        <button
          onClick={seDeconnecter}
          className="group mt-2 flex w-full items-center gap-2 rounded-xl text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
        >
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            {connecte ? (
              <LogOut size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            ) : (
              <LogIn size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            )}
          </span>
          <LibelleRail ouverte={ouverte}>{connecte ? "Se déconnecter" : "Se connecter"}</LibelleRail>
        </button>

        {connecte ? (
          <MenuProfil
            avatarUrl={avatarUrl}
            nomAffiche={nomAffiche}
            ouverte={ouverte}
            LibelleRail={LibelleRail}
            onNaviguerVersParametres={() => router.push("/parametres")}
            onSeDeconnecter={seDeconnecter}
          />
        ) : (
          <div className="flex w-full items-center gap-2 rounded-xl text-dj-texte-muet">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <Logo taille={18} />
            </span>
            <LibelleRail ouverte={ouverte}>
              <span className="font-display font-bold tracking-tight">Clovis</span>
            </LibelleRail>
          </div>
        )}
      </div>

      {/* Panneau plein écran mobile, même logique que desktop. */}
      {ouverte && (
        <div className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto overflow-x-hidden border-r border-dj-bordure bg-dj-fond px-2 py-3 md:hidden">
          <div className="mt-8">
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
                        historiqueDeplie ? "text-dj-accent-1" : "text-dj-texte-muet"
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
                                estActive ? "text-dj-accent-1" : "text-dj-texte hover:text-dj-accent-1"
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
              <LienOnglet key={o.href} onglet={o} mouvement={MOUVEMENT_NAV} mobile />
            ))}
          </div>

          <div className="mt-2 flex justify-center">
            <BoutonInstaller />
          </div>

          <div className="mt-2 rounded-xl px-2">
            <button
              onClick={() => setActionsDeplie((v) => !v)}
              className={`group flex w-full items-center gap-2 py-2 text-sm transition-colors ${
                actionsDeplie ? "text-dj-accent-1" : "text-dj-texte-muet"
              }`}
            >
              <MoreHorizontal size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
              Actions
            </button>
            {actionsDeplie && (
              <div className="flex flex-col gap-2 pb-2">
                {contexteChat &&
                  ongletsDansActions.map((o) => {
                    const actif = pathname === o.href;
                    return (
                      <Link
                        key={o.href}
                        href={o.href}
                        onClick={(e) => {
                          setActionsDeplie(false);
                          setOuverte(false);
                          e.preventDefault();
                          ouvrirFenetre(o.id);
                        }}
                        className={`group relative flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                          actif ? "text-dj-accent-1" : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
                        }`}
                      >
                        <o.Icone size={16} />
                        {o.label}
                        {actif && <TraitSignature className="absolute bottom-0.5 left-2" />}
                      </Link>
                    );
                  })}

                <button
                  onClick={partager}
                  className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                >
                  <Share2 size={16} className="transition-transform duration-200 group-hover:-rotate-12" />
                  {copie ? "Copié !" : "Partager"}
                </button>
                <button
                  onClick={() => setAvisDeplie((v) => !v)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                    avisDeplie ? "text-dj-accent-1" : "text-dj-texte-muet"
                  }`}
                >
                  <Star size={16} className="transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
                  Avis sur Clovis
                </button>
                {avisDeplie && (
                  <div className="flex flex-col gap-4 px-2 pb-2">
                    <NoteAgent agentId={AGENT_ID} />
                    <CommentairesAgent agentId={AGENT_ID} />
                  </div>
                )}
                <button
                  onClick={() => {
                    onOuvrirCatalogue();
                    setOuverte(false);
                  }}
                  className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
                >
                  <Compass size={16} className="transition-transform duration-300 group-hover:rotate-45" />
                  Pourquoi Clovis ?
                </button>
              </div>
            )}
          </div>

          <ThemeToggle LibelleRail={LibelleRail} ouverte={ouverte} mobile />

          {connecte && (
            <Link
              href="/parametres"
              onClick={() => setOuverte(false)}
              className="flex w-full items-center gap-2 rounded-xl px-2 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                <span className="h-6 w-6 overflow-hidden rounded-full border border-dj-bordure bg-dj-surface-haute">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar_url vient de Supabase Storage, hôte dynamique
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-dj-texte-muet">
                      {(nomAffiche || "Mon compte").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
              <span className="text-sm">{nomAffiche || "Mon compte"}</span>
            </Link>
          )}

          <button
            onClick={seDeconnecter}
            className="group mt-auto flex w-full items-center gap-2 rounded-xl px-2 text-dj-texte-muet transition-colors hover:bg-dj-surface-haute hover:text-dj-texte"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
              {connecte ? (
                <LogOut size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              ) : (
                <LogIn size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              )}
            </span>
            <span className="text-sm">{connecte ? "Se déconnecter" : "Se connecter"}</span>
          </button>
        </div>
      )}
    </>
  );
}
