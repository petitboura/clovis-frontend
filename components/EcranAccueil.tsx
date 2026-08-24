"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bird, MessageSquare, Library, ScanSearch, BookOpen, type LucideIcon } from "lucide-react";
import { appelerApi, listerProgrammes, listerAuditsProgramme, listerMatieresProgramme } from "@/lib/api";
import { dateRelative } from "@/lib/dateRelative";
import { useOuvrirChat } from "@/lib/contexteChat";
import { texteAccueilTableauDeBordSelonHeure } from "@/lib/salutations";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/Skeleton";
import { Carte } from "@/components/Carte";
import { ONGLETS } from "@/components/AppSidebar";

// Écran d'accueil réel de l'app (16/08/2026, demande Bourama : "faut une
// vraie écran d'accueil pour l'app, pas un lieu dans l'app" -- avant
// cette page, "/" redirigeait simplement vers /programme, qui n'a jamais
// été conçu pour être un accueil). Combine, comme demandé ("les deux, à
// voir ensemble") :
// - un écran de bienvenue (message + accès rapide au chat)
// - un tableau de bord (raccourcis vers chaque section + activité
//   récente RÉELLE -- pas d'échéances, aucune donnée de date limite
//   n'existe dans le modèle programme actuel, voir échange avec Bourama)

type ActiviteItem = {
  id: string;
  type: "conversation" | "bibliotheque" | "audit" | "programme";
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
  const ouvrirChat = useOuvrirChat();
  const [activite, setActivite] = useState<ActiviteItem[] | null>(null);

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

      // Audits + matières modifiées -- nécessite de lister les
      // programmes d'abord (pas de endpoint global "tous mes audits").
      try {
        const programmes = await listerProgrammes();
        for (const p of programmes) {
          try {
            const audits = await listerAuditsProgramme(p.id);
            for (const a of audits) {
              if (!a.derniere_execution) continue;
              items.push({
                id: `audit-${a.matiere_id}`,
                type: "audit",
                Icone: ScanSearch,
                label: `Audit : ${a.matiere_nom}`,
                date: a.derniere_execution,
                href: "/audits",
              });
            }
          } catch {
            // Programme sans audits accessibles -- ignoré.
          }

          try {
            const matieres = await listerMatieresProgramme(p.id);
            for (const m of matieres) {
              items.push({
                id: `matiere-${m.id}`,
                type: "programme",
                Icone: BookOpen,
                label: `Programme modifié : ${m.nom}`,
                date: m.updated_at,
                href: "/programme",
              });
            }
          } catch {
            // Idem.
          }
        }
      } catch {
        // Visiteur sans compte -- pas de programme, section ignorée.
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

  return (
    <div className="mx-auto w-full max-w-3xl animate-dj-fade-in space-y-10 px-4 pb-24 pt-8 md:pt-12">
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
            onClick={ouvrirChat}
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
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-dj-texte-muet">
          Mon espace
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ONGLETS.map((o) => (
            <Link key={o.id} href={o.href} className="group">
              <Carte className="flex h-full flex-col items-start gap-3 !p-4 hover:bg-dj-surface-haute">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-cgpt-bouton bg-dj-surface-haute text-dj-texte transition-transform duration-200 ${MOUVEMENT_CARTE}`}
                >
                  <o.Icone size={18} />
                </span>
                <span className="text-sm font-semibold text-dj-texte">{o.label}</span>
              </Carte>
            </Link>
          ))}
        </div>
      </div>

      {/* Activité récente */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-dj-texte-muet">
          Activité récente
        </h2>

        {activite === null && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
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
                  onClick={ouvrirChat}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-dj-surface"
                >
                  <item.Icone size={16} className="flex-shrink-0 text-dj-texte-muet transition-transform group-hover:scale-110" />
                  <span className="min-w-0 flex-1 truncate text-sm text-dj-texte">{item.label}</span>
                  <span className="flex-shrink-0 text-xs text-dj-texte-muet">{dateRelative(item.date)}</span>
                </button>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-dj-surface"
                >
                  <item.Icone size={16} className="flex-shrink-0 text-dj-texte-muet transition-transform group-hover:scale-110" />
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
