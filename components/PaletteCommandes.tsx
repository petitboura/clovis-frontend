"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Home,
  MessageSquarePlus,
  Maximize2,
  MessageCircle,
  Compass,
  Monitor,
  Sun,
  Moon,
  LogOut,
  LogIn,
} from "lucide-react";
import { ONGLETS } from "@/components/AppSidebar";
import { useTheme, type ChoixTheme } from "@/lib/useTheme";
import { supabase } from "@/lib/supabase";
import type { EtatChat } from "@/lib/contexteChat";

// Palette de commandes (Cmd+K / Ctrl+K), 22/08/2026, demande Bourama --
// un des chantiers "grandes applis" (avec fil d'Ariane et historique dans
// la nav principale). Version "complète" choisie explicitement par
// Bourama : navigue ET déclenche des actions réelles, pas une simple
// recherche (comme Railway/Supabase, pas juste Notion). Montée une seule
// fois dans AppShell.tsx, au même niveau que la sidebar et le chat
// flottant, donc disponible partout dans l'app.
//
// Pour "Nouvelle conversation" : cette palette n'a pas sa propre logique
// de chat, elle appelle la vraie fonction interne de ChatFlottant.tsx via
// une ref pont (nouvelleConversationRef, voir AppShell.tsx) plutôt que de
// dupliquer cle/messagesInitiaux/etc. ici.
const ORDRE_THEME: ChoixTheme[] = ["systeme", "clair", "sombre"];
const ICONE_THEME = { systeme: Monitor, clair: Sun, sombre: Moon };
const LIBELLE_THEME = { systeme: "Système", clair: "Clair", sombre: "Sombre" };

type Commande = {
  id: string;
  label: string;
  sousLabel?: string;
  Icone: typeof Home;
  action: () => void;
};

export function PaletteCommandes({
  connecte,
  etatChat,
  setEtatChat,
  onOuvrirCatalogue,
  nouvelleConversationRef,
}: {
  connecte: boolean;
  etatChat: EtatChat;
  setEtatChat: (etat: EtatChat) => void;
  onOuvrirCatalogue: () => void;
  nouvelleConversationRef: React.MutableRefObject<(() => void) | null>;
}) {
  const router = useRouter();
  const { choix, changerTheme } = useTheme();
  const [ouverte, setOuverte] = useState(false);
  const [requete, setRequete] = useState("");
  const [surligne, setSurligne] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuverte((v) => !v);
      } else if (e.key === "Escape") {
        setOuverte(false);
      }
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, []);

  useEffect(() => {
    if (!ouverte) return;
    setRequete("");
    setSurligne(0);
    // Laisse l'animation d'entrée démarrer avant de voler le focus.
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [ouverte]);

  async function seDeconnecterOuConnecter() {
    if (!connecte) {
      router.push("/connexion");
      return;
    }
    await supabase.auth.signOut();
    router.push("/connexion");
  }

  function suivantTheme() {
    const i = ORDRE_THEME.indexOf(choix);
    changerTheme(ORDRE_THEME[(i + 1) % ORDRE_THEME.length]);
  }

  const commandes: Commande[] = useMemo(() => {
    const nav: Commande[] = [
      { id: "accueil", label: "Aller à Accueil", Icone: Home, action: () => router.push("/") },
      ...ONGLETS.map((o) => ({
        id: `nav-${o.id}`,
        label: `Aller à ${o.label}`,
        Icone: o.Icone,
        action: () => router.push(o.href),
      })),
    ];

    const actions: Commande[] = [
      {
        id: "nouvelle-conversation",
        label: "Nouvelle conversation",
        sousLabel: "Efface le fil en cours",
        Icone: MessageSquarePlus,
        action: () => {
          nouvelleConversationRef.current?.();
          setEtatChat(etatChat === "fermee" ? "mini" : etatChat);
        },
      },
      { id: "ouvrir-chat", label: "Ouvrir le chat", Icone: MessageCircle, action: () => setEtatChat("mini") },
      {
        id: "chat-plein-ecran",
        label: "Ouvrir Clovis en plein écran",
        Icone: Maximize2,
        action: () => setEtatChat("plein_ecran"),
      },
      {
        id: "theme",
        label: "Changer de thème",
        sousLabel: `Actuel : ${LIBELLE_THEME[choix]}`,
        Icone: ICONE_THEME[choix],
        action: suivantTheme,
      },
      { id: "pourquoi-clovis", label: "Pourquoi Clovis ?", Icone: Compass, action: onOuvrirCatalogue },
      {
        id: "compte",
        label: connecte ? "Se déconnecter" : "Se connecter",
        Icone: connecte ? LogOut : LogIn,
        action: seDeconnecterOuConnecter,
      },
    ];

    return [...nav, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choix, connecte, etatChat]);

  const filtrees = useMemo(() => {
    const q = requete.trim().toLowerCase();
    if (!q) return commandes;
    return commandes.filter(
      (c) => c.label.toLowerCase().includes(q) || c.sousLabel?.toLowerCase().includes(q)
    );
  }, [commandes, requete]);

  function executer(c: Commande) {
    c.action();
    setOuverte(false);
  }

  if (!ouverte) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex animate-dj-fade-in-rapide items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onClick={() => setOuverte(false)}
    >
      <div
        className="w-full max-w-lg animate-cgpt-entree-modal overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-dj-bordure px-4 py-3">
          <Search size={16} className="flex-shrink-0 text-dj-texte-muet" />
          <input
            ref={inputRef}
            value={requete}
            onChange={(e) => {
              setRequete(e.target.value);
              setSurligne(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSurligne((s) => Math.min(s + 1, filtrees.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSurligne((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && filtrees[surligne]) {
                executer(filtrees[surligne]);
              }
            }}
            placeholder="Naviguer ou faire une action…"
            className="w-full bg-transparent text-sm text-dj-texte placeholder:text-dj-texte-muet focus:outline-none"
          />
          <kbd className="flex-shrink-0 rounded border border-dj-bordure px-1.5 py-0.5 text-xs text-dj-texte-muet">
            Échap
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtrees.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-dj-texte-muet">Aucun résultat.</p>
          )}
          {filtrees.map((c, i) => (
            <button
              key={c.id}
              onClick={() => executer(c)}
              onMouseEnter={() => setSurligne(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                i === surligne
                  ? "bg-dj-surface-haute text-dj-texte"
                  : "text-dj-texte-muet hover:bg-dj-surface-haute hover:text-dj-texte"
              }`}
            >
              <c.Icone size={16} className="flex-shrink-0" />
              <span className="flex-1 text-sm">{c.label}</span>
              {c.sousLabel && <span className="flex-shrink-0 text-xs text-dj-texte-muet">{c.sousLabel}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
