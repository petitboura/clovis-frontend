"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, Library, MessageSquare, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useOuvrirChat } from "@/lib/contexteChat";

// Créé le 28/08/2026, Bourama : chantier "web mobile façon appli" --
// remplace le menu hamburger + tiroir (AppSidebar en mode mobile, masqué
// pour de bon désormais via masquerChromeMobile, voir AppShell.tsx) par
// une vraie barre d'onglets fixe en bas, pour le SITE/PWA dans le
// navigateur uniquement (jamais dans l'appli native Capacitor, qui a sa
// propre barre système, voir components/mobile/BarreOngletsNative.tsx).
//
// Partie 1 navigation mobile (29-30/08/2026) : ajoute Chat comme 3e
// onglet (au centre exact des 5), pour rester cohérent avec la barre
// native qui a désormais Chat + Bureau tous les deux (voir
// BarreOngletsNative.tsx) -- ce chantier ne touche PAS au menu Plus
// (reste la page /plus existante, catch-all pour Personnaliser Clovis/
// Connecter Claude/Paramètres, jamais transformé en hamburger côté web,
// contrairement au natif -- pas retouché ici). Chat ouvre l'overlay
// flottant existant (useOuvrirChat), pas une route à part, même logique
// que côté natif.
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
  { type: "lien", href: "/", label: "Accueil", Icone: Home },
  { type: "lien", href: "/bibliotheque", label: "Bibliothèque", Icone: Library },
  { type: "chat", label: "Chat", Icone: MessageSquare },
  { type: "lien", href: "/bureau", label: "Bureau", Icone: Briefcase },
  { type: "lien", href: "/plus", label: "Plus", Icone: MoreHorizontal },
];

export function BarreOngletsWeb() {
  const pathname = usePathname();
  const ouvrirChat = useOuvrirChat();
  // "Plus" agit comme catch-all : actif dès qu'on n'est sur AUCUNE des
  // 3 autres routes directes -- volontairement pas une liste figée de
  // sous-routes (personnaliser/connecter-claude/parametres/...), qui
  // aurait besoin d'être tenue à jour à chaque nouvelle page ajoutée
  // sous Plus. Tout ce qui n'est pas explicitement Accueil/Bibliothèque/
  // Bureau tombe dans Plus, par construction.
  const routesDirectes = new Set(["/", "/bibliotheque", "/bureau"]);
  const ongletActifHref = routesDirectes.has(pathname) ? pathname : "/plus";

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
              onClick={ouvrirChat}
              className="group flex flex-1 flex-col items-center justify-center gap-0.5 text-dj-texte-muet transition-colors"
            >
              <o.Icone size={20} className="flex-shrink-0" />
              <span className="text-[11px] leading-none">{o.label}</span>
            </button>
          );
        }
        const actif = o.href === ongletActifHref;
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
