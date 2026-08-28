"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, Library, MoreHorizontal, type LucideIcon } from "lucide-react";

// Créé le 28/08/2026, Bourama : chantier "web mobile façon appli" --
// remplace le menu hamburger + tiroir (AppSidebar en mode mobile, masqué
// pour de bon désormais via masquerChromeMobile, voir AppShell.tsx) par
// une vraie barre d'onglets fixe en bas, pour le SITE/PWA dans le
// navigateur uniquement (jamais dans l'appli native Capacitor, qui a sa
// propre barre système, voir components/mobile/BarreOngletsNative.tsx --
// chantier séparé, pas retouché ici, demande explicite Bourama : "l'appli
// mobile, lui on y retravaillera plus tard").
//
// Onglets choisis par Bourama (28/08) : les 4 mêmes que le rail desktop
// direct (voir navComplete dans AppSidebar.tsx) -- Accueil, Bureau,
// Bibliothèque, Plus (catch-all pour tout le reste : Personnaliser
// Clovis, Connecter Claude, Paramètres -- voir EspacePlus.tsx). Pas de
// Chat séparé ici : sur le web, le chat reste la bulle flottante
// existante (ChatFlottant.tsx), jamais un onglet à part.
//
// Rendu en CSS/React pur, jamais visible au-delà du point de rupture md
// (768px, rail desktop prend le relais) -- voir --dj-barre-onglets-web
// dans app/globals.css pour la marge réservée en bas de <main> et des
// éléments flottants (ChatFlottant.tsx, EspaceBibliotheque.tsx) afin que
// rien ne se retrouve caché derrière cette barre.
const ONGLETS_WEB: { href: string; label: string; Icone: LucideIcon }[] = [
  { href: "/", label: "Accueil", Icone: Home },
  { href: "/bureau", label: "Bureau", Icone: Briefcase },
  { href: "/bibliotheque", label: "Bibliothèque", Icone: Library },
  { href: "/plus", label: "Plus", Icone: MoreHorizontal },
];

export function BarreOngletsWeb() {
  const pathname = usePathname();
  // "Plus" agit comme catch-all : actif dès qu'on n'est sur AUCUNE des
  // 3 autres routes directes -- volontairement pas une liste figée de
  // sous-routes (personnaliser/connecter-claude/parametres/...), qui
  // aurait besoin d'être tenue à jour à chaque nouvelle page ajoutée
  // sous Plus. Tout ce qui n'est pas explicitement Accueil/Bureau/
  // Bibliothèque tombe dans Plus, par construction.
  const routesDirectes = new Set(["/", "/bureau", "/bibliotheque"]);
  const ongletActifHref = routesDirectes.has(pathname) ? pathname : "/plus";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch justify-around border-t border-dj-bordure bg-dj-fond md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      {ONGLETS_WEB.map((o) => {
        const actif = o.href === ongletActifHref;
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`group flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              actif ? "text-dj-accent-1" : "text-dj-texte-muet"
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
