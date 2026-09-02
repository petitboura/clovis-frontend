"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bird, MessageSquare, Library, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { appelerApi } from "@/lib/api";
import { dateRelative } from "@/lib/dateRelative";
import { useOuvrirChat } from "@/lib/contexteChat";
import { texteAccueilTableauDeBordSelonHeure } from "@/lib/salutations";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/Skeleton";
import { Carte } from "@/components/Carte";
import { ONGLETS } from "@/components/AppSidebar";

// Écran d'accueil réel de l'app (16/08/2026, demande Bourama : "faut une
// vraie écran d'accueil pour l'app, pas un lieu dans l'app" -- avant
// cette page, "/" redirigeait simplement vers une section interne, qui
// n'a jamais été conçue pour être un accueil). Combine, comme demandé
// ("les deux, à voir ensemble") :
// - un écran de bienvenue (message + accès rapide au chat)
// - un tableau de bord (raccourcis vers chaque section + activité
//   récente RÉELLE -- pas d'échéances, aucune donnée de date limite
//   n'existe dans le modèle actuel, voir échange avec Bourama)

type ActiviteItem = {
  id: string;
  type: "conversation" | "bibliotheque";
  Icone: LucideIcon;
  label: string;
  date: string;
  href: string;
};

// Un seul mouvement de survol, appliqué à toutes les cartes (refonte
// accueil/sidebar, 22/08/2026, demande Bourama : "corrige tout, même la
// logique d'affichage si besoin"). Remplace les 7 mouvements différents
// d'origine (16/08), chacun raisonnable pris isolément, mais juxtaposés
// sur la même grille ça se lisait comme 7 décisions séparées plutôt
// qu'une navigation pensée comme un tout. Un léger soulèvement, cohérent
// avec le "lift" déjà utilisé sur les boutons de la sidebar.
const MOUVEMENT_CARTE = "group-hover:-translate-y-1";

export function EcranAccueil() {
  const router = useRouter();
  const ouvrirChat = useOuvrirChat();
  const [activite, setActivite] = useState<ActiviteItem[] | null>(null);

  // 31/08/2026, demande Bourama : "plus de tolérance", création de
  // compte demandée directement à l'arrivée, automatiquement -- fini le
  // mode invité sur l'écran d'accueil. Même pattern que la vérification
  // de session déjà en place sur app/inscription/page.tsx et
  // app/connexion/page.tsx (les deux redirigent déjà l'inverse : session
  // active -> "/"). Ici : pas de session -> redirection bloquante vers
  // "/inscription" (qui garde son lien "Déjà un compte ? Se connecter",
  // donc la connexion reste atteignable). Rien de l'accueil (JSX plus
  // bas) n'est rendu tant que ce check n'a pas tranché -- voir le
  // `if (verificationSession) return null;` en fin de fonction. Portée
  // volontairement limitée à cet écran (Bourama a confirmé garder le
  // mode sans compte inchangé ailleurs -- Bibliothèque, Comportements,
  // Mes codes, Paramètres, Ma mémoire -- pas de suppression globale).
  const [verificationSession, setVerificationSession] = useState(true);
  useEffect(() => {
    let annule = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (annule) return;
      if (!session) {
        router.replace("/inscription");
        return;
      }
      setVerificationSession(false);
    });
    return () => {
      annule = true;
    };
  }, [router]);

  // Titre d'accueil variable selon l'heure + révélation lettre par lettre
  // (18/08/2026, demande Bourama : "on fait pareil" que le chat, voir
  // ChatFlottant.tsx/ChatIA.tsx -- même fonction partagée, voir
  // lib/salutations.ts). Le texte de l'heure est figé au montage de la
  // page (pas de mise à jour live tant que l'onglet reste ouvert).
  const [titreAccueilEcran] = useState(texteAccueilTableauDeBordSelonHeure);
  const [titreRevele, setTitreRevele] = useState("");
  useEffect(() => {
    setTitreRevele("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTitreRevele(titreAccueilEcran.slice(0, i));
      if (i >= titreAccueilEcran.length) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [titreAccueilEcran]);

  useEffect(() => {
    let annule = false;

    async function charger() {
      const items: ActiviteItem[] = [];

      // Conversations récentes -- même endpoint que ChatFlottant.tsx.
      try {
        const fils: { conversation_id: string | null; titre: string; derniere_activite: string }[] =
          await appelerApi("/api/historique/clovis/conversations");
        for (const f of fils) {
          items.push({
            id: `conv-${f.conversation_id ?? "legacy"}`,
            type: "conversation",
            Icone: MessageSquare,
            label: `Conversation : ${f.titre}`,
            date: f.derniere_activite,
            href: "#chat",
          });
        }
      } catch {
        // Visiteur sans compte ou erreur réseau -- section ignorée, pas
        // d'erreur bloquante pour un simple résumé.
      }

      // Fichiers récemment ajoutés à la Bibliothèque.
      try {
        const fichiers: { id: string; nom_fichier: string; created_at: string }[] = await appelerApi(
          "/api/bibliotheque"
        );
        for (const f of fichiers) {
          items.push({
            id: `biblio-${f.id}`,
            type: "bibliotheque",
            Icone: Library,
            label: `Ajouté à la bibliothèque : ${f.nom_fichier}`,
            date: f.created_at,
            href: "/bibliotheque",
          });
        }
      } catch {
        // Idem.
      }

      if (!annule) {
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setActivite(items.slice(0, 8));
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, []);

  // Tant que la session n'est pas confirmée, rien de l'accueil n'est
  // rendu (ni le contenu, ni un skeleton) -- soit la redirection vers
  // /inscription est déjà en cours (invité), soit ça tranche en un
  // instant (session déjà en cache côté supabase-js), pas besoin d'un
  // état de chargement visible ici contrairement à app/inscription/page.tsx
  // (formulaire complexe) qui en a un pour éviter un flash de mise en page.
  if (verificationSession) return null;

  return (
    // animate-dj-fade-in retiré le 01/09/2026 : voir le même correctif
    // et la même explication dans components/SectionPage.tsx
    // (TransitionPage.tsx anime désormais l'entrée/sortie de toute page).
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 pb-24 pt-8 md:pt-12">
      {/* Bienvenue : vrai moment d'entrée (refonte 22/08/2026, demande
          Bourama : "faut une vraie hiérarchie, pas 8 cartes à plat").
          Avant : logo/titre/bouton empilés au même niveau visuel que le
          reste de la page, aucun repère ne disait "tu es à l'entrée de
          l'appli". dj-hero-glow existait déjà dans le système de tokens
          (utilisé ailleurs, ex. Logo/GraphiqueDonnees) mais n'était
          jamais posé ici : un seul repère lumineux, discret, pas une
          bannière décorative. */}
      <div className="relative overflow-hidden pb-2 pt-2">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-dj-hero-glow" aria-hidden="true" />
        <div className="flex flex-col items-center gap-5 text-center">
          <Logo taille={52} />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dj-texte md:text-4xl">
              {titreRevele}
            </h1>
            <p className="mt-2 text-base text-dj-texte-muet">Ton compagnon d&apos;études, à tes côtés.</p>
          </div>
          <button
            onClick={() => ouvrirChat()}
            className="group flex items-center gap-2 rounded-xl bg-dj-gradient px-5 py-3 text-sm font-bold text-[#1A0D02] shadow-[0_4px_20px_rgba(184,134,11,0.25)] transition-transform duration-200 ease-cgpt-geste hover:scale-[1.02] active:scale-[0.98]"
          >
            <Bird size={18} className="transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
            Ouvrir le chat
          </button>
        </div>
      </div>

      {/* Raccourcis vers chaque section : utilise désormais le composant
          Carte partagé (rayon signature cgpt-carte, easing cgpt-doux,
          bordure qui se renforce au survol) au lieu de div ad hoc en
          rounded-xl : c'était la seule zone de l'app à ne pas suivre ce
          standard déjà en place partout ailleurs. Icône dans une puce
          teintée pour donner du poids visuel à chaque raccourci plutôt
          qu'une icône flottant seule dans la carte. */}
      {/* Hiérarchie du texte (26/08/2026, demande Bourama : le gris
          discret dj-texte-muet était réutilisé partout de façon uniforme,
          sur les titres de section comme sur les icônes et labels de
          l'activité récente, ce qui écrasait toute hiérarchie. Il ne
          reste réservé qu'aux dates, vraiment secondaires ; titres,
          icônes et labels passent en dj-texte pour redevenir lisibles.
          Les icônes des raccourcis "Mon espace" ne sont volontairement
          pas touchées ici. */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-dj-texte">
          Mon espace
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ONGLETS.map((o) => (
            <Link key={o.id} href={o.href} className="group">
              <Carte className="flex h-full flex-col items-start gap-3 !p-4 hover:bg-dj-surface-haute">
                <o.Icone
                  size={20}
                  className={`flex-shrink-0 text-dj-texte transition-transform duration-200 ${MOUVEMENT_CARTE}`}
                />
                <span className="text-sm font-semibold text-dj-texte">{o.label}</span>
              </Carte>
            </Link>
          ))}
        </div>
      </div>

      {/* Activité récente */}
      <div>
        {/* Hiérarchie du texte (26/08/2026, demande Bourama : le gris
            discret dj-texte-muet était réutilisé partout de façon uniforme,
            sur les titres de section comme sur les icônes et labels de
            l'activité récente, ce qui écrasait toute hiérarchie. Il ne
            reste réservé qu'aux dates, vraiment secondaires ; titres,
            icônes et labels passent en dj-texte pour redevenir lisibles.
            Les icônes des raccourcis "Mon espace" ne sont volontairement
            pas touchées ici. */}
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-dj-texte">
          Activité récente
        </h2>

        {/* Skeleton précis (30/08, audit) : le vrai contenu n'a pas de
            cadre (juste hover:bg-dj-surface), icône plate 16px (pas de
            rond), une seule ligne de nom + une date courte à droite,
            hauteur naturelle (px-3 py-2.5) plutôt qu'un h-12 fixe qui ne
            correspondait à rien de réel. 5 lignes plutôt que 3 -- le vrai
            contenu va jusqu'à 8 éléments (items.slice(0, 8)). */}
        {activite === null && (
          <div className="flex flex-col gap-1" aria-hidden>
            {[
              { largeur: "w-2/5", delai: "0ms" },
              { largeur: "w-3/5", delai: "80ms" },
              { largeur: "w-1/3", delai: "160ms" },
              { largeur: "w-1/2", delai: "240ms" },
              { largeur: "w-2/3", delai: "320ms" },
            ].map(({ largeur, delai }, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Skeleton className="h-4 w-4 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
                <div className="min-w-0 flex-1">
                  <Skeleton className={`h-3.5 rounded ${largeur}`} style={{ animationDelay: delai }} />
                </div>
                <Skeleton className="h-3 w-10 flex-shrink-0 rounded" style={{ animationDelay: delai }} />
              </div>
            ))}
          </div>
        )}

        {activite !== null && activite.length === 0 && (
          <p className="text-sm text-dj-texte-muet">Rien pour l&apos;instant, lance une conversation pour commencer.</p>
        )}

        {activite !== null && activite.length > 0 && (
          <div className="flex flex-col gap-1">
            {activite.map((item) =>
              item.href === "#chat" ? (
                <button
                  key={item.id}
                  onClick={() => ouvrirChat()}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-dj-surface"
                >
                  <item.Icone size={16} className="flex-shrink-0 text-dj-texte transition-transform group-hover:scale-110" />
                  <span className="min-w-0 flex-1 truncate text-sm text-dj-texte">{item.label}</span>
                  <span className="flex-shrink-0 text-xs text-dj-texte-muet">{dateRelative(item.date)}</span>
                </button>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-dj-surface"
                >
                  <item.Icone size={16} className="flex-shrink-0 text-dj-texte transition-transform group-hover:scale-110" />
                  <span className="min-w-0 flex-1 truncate text-sm text-dj-texte">{item.label}</span>
                  <span className="flex-shrink-0 text-xs text-dj-texte-muet">{dateRelative(item.date)}</span>
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
