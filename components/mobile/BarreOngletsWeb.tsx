"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Hourglass, MessageCircle, Briefcase, Wand2, type LucideIcon } from "lucide-react";
import { useOuvrirChat } from "@/lib/contexteChat";

// Créé le 28/08/2026, Bourama : chantier "web mobile façon appli",
// remplace le menu hamburger + tiroir (AppSidebar en mode mobile, masqué
// pour de bon désormais via masquerChromeMobile, voir AppShell.tsx) par
// une vraie barre d'onglets fixe en bas, pour le SITE/PWA dans le
// navigateur uniquement (jamais dans l'appli native Capacitor, qui a sa
// propre barre système, voir components/mobile/BarreOngletsNative.tsx).
//
// 30/08/2026, audit navigation web mobile vs natif, étape 1 (demande
// Bourama : faire converger vers le natif partout où c'est possible) :
// les 5 onglets sont désormais identiques à BarreOngletsNative.tsx, même
// ordre, mêmes icônes (Bibliothèque, Concentration, Chat, Bureau,
// Personnaliser Clovis). Accueil et Plus, qui occupaient deux onglets
// directs ici mais n'existaient pas côté natif, rejoignent le menu Plus
// unifié (voir MenuHamburgerWeb.tsx, nouveau, même mécanique que le
// natif, remplace l'ancienne page /plus, désormais une redirection).
// Concentration pointe vers /controle-session, resté inatteignable côté
// web jusqu'ici (écran orphelin signalé par Bourama).
//
// Icônes reprises à l'identique des tracés utilisés côté natif
// (ICONES_SVG dans BarreOngletsNative.tsx, qui doivent rester du SVG brut
// pour le plugin Capacitor), ici en composants Lucide directs
// (Hourglass = même tracé que "controleSession", MessageCircle = même
// tracé que "chat"), pour un rendu visuel identique sans dupliquer le SVG
// à la main.
//
// Rendu en CSS/React pur, jamais visible au-delà du point de rupture md
// (768px, rail desktop prend le relais) -- voir --dj-barre-onglets-web
// dans app/globals.css pour la marge réservée en bas de <main> et des
// éléments flottants (ChatFlottant.tsx, EspaceBibliotheque.tsx) afin que
// rien ne se retrouve caché derrière cette barre.
const ONGLETS_WEB: (
  | { type: "lien"; href: string; label: string; Icone: LucideIcon }
  | { type: "chat"; label: string; Icone: LucideIcon }
)[] = [
  { type: "lien", href: "/bibliotheque", label: "Bibliothèque", Icone: Library },
  { type: "lien", href: "/controle-session", label: "Concentration", Icone: Hourglass },
  { type: "chat", label: "Chat", Icone: MessageCircle },
  { type: "lien", href: "/bureau", label: "Bureau", Icone: Briefcase },
  { type: "lien", href: "/personnaliser", label: "Personnaliser Clovis", Icone: Wand2 },
];

export function BarreOngletsWeb() {
  const pathname = usePathname();
  const ouvrirChat = useOuvrirChat();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch justify-around border-t border-dj-bordure bg-dj-fond md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Navigation principale"
    >
      {ONGLETS_WEB.map((o) => {
        if (o.type === "chat") {
          return (
            <button
              key="chat"
              type="button"
              onClick={() => ouvrirChat("plein_ecran")}
              className="group flex flex-1 flex-col items-center justify-center gap-0.5 text-dj-texte-muet transition-colors"
            >
              <o.Icone size={20} className="flex-shrink-0" />
              <span className="text-[11px] leading-none">{o.label}</span>
            </button>
          );
        }
        const actif = pathname === o.href || pathname.startsWith(o.href + "/");
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`group flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              actif ? "text-dj-accent-1-texte" : "text-dj-texte-muet"
            }`}
          >
            <o.Icone size={20} className="flex-shrink-0" />
            <span className="text-[11px] leading-none">{o.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
