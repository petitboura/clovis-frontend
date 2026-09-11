"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Check, Lock } from "lucide-react";
import {
  listerMesRattachementsCodes,
  obtenirModeActif,
  definirModeActif,
  obtenirMonStatut,
  type RattachementCode,
} from "@/lib/api";

/**
 * Sélecteur de mode actif (Partie 6, plan confiance pédagogique,
 * 06/09/2026, demande Bourama -- voir Point 3). Un utilisateur peut
 * avoir plusieurs codes rattachés en même temps (voir EspaceEntrerCode)
 * -- ce composant lui permet de choisir librement lequel s'applique à
 * la conversation en cours, avec indication permanente. Rien à afficher
 * s'il n'a aucun rattachement et qu'il n'est pas mineur (rien à
 * choisir).
 *
 * Placement : en haut du chat sur mobile (position fixe, à droite du
 * hamburger tiroir qui occupe déjà la gauche -- voir AppSidebar.tsx),
 * près de la barre de saisie sur PC. Un seul composant, deux
 * habillages CSS responsive partageant le même état -- pas de double
 * appel réseau.
 *
 * Partie 7 (06/09) : pour un mineur (profiles.est_majeur = false
 * explicitement) --
 * - un seul rattachement -> appliqué automatiquement, rien à choisir
 *   (ce n'est de toute façon pas un choix s'il n'y a qu'une option) ;
 * - plusieurs rattachements et aucun mode choisi -> même sélecteur que
 *   pour un majeur, mais le premier choix devient définitif pour cette
 *   conversation (voir `verrouille`, renvoyé par le backend) ;
 * - aucun rattachement -> accès bloqué, message clair (voir
 *   `onAccesBloqueChange`, pour que ChatIA désactive la barre de
 *   saisie) plutôt que l'erreur technique que renverrait sinon
 *   l'envoi d'un message (voir aussi api/chat.py, qui bloque aussi
 *   côté serveur).
 *
 * 11/09/2026 (demande Bourama, majeurs uniquement) : une vraie option
 * "Aucun mode" est proposée dans la liste, en plus des rattachements --
 * jusqu'ici impossible à choisir, le sélecteur ne listait que les codes
 * reçus. Choisie, Clovis redevient pour cette conversation exactement
 * comme si l'utilisateur n'avait aucun code (mêmes documents personnels
 * reçus par dossier, tout le reste -- comportements, programme, notes du
 * prof -- ignoré, voir core/mode_actif_conversation.py::MODE_DESACTIVE
 * côté backend). Non proposée aux mineurs (Partie 7 : pas de version
 * neutre sans code pour eux, hors périmètre).
 */
export function SelecteurModeActif({
  conversationId,
  onAccesBloqueChange,
}: {
  conversationId: string;
  onAccesBloqueChange?: (bloque: boolean) => void;
}) {
  const [rattachements, setRattachements] = useState<RattachementCode[]>([]);
  const [modeActifId, setModeActifId] = useState<string | null>(null);
  // true si un choix explicite existe déjà pour cette conversation (y
  // compris "Aucun mode"), pour distinguer ça de "rien choisi encore" --
  // les deux ont modeActifId === null (11/09/2026, voir docstring).
  const [choisi, setChoisi] = useState(false);
  const [verrouille, setVerrouille] = useState(false);
  const [mineur, setMineur] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    Promise.all([listerMesRattachementsCodes(), obtenirModeActif(conversationId), obtenirMonStatut()])
      .then(async ([rat, mode, statut]) => {
        if (annule) return;
        const estMineur = statut.est_majeur === false;
        setMineur(estMineur);
        setRattachements(rat);
        setVerrouille(mode.verrouille);

        // Mineur avec un seul rattachement et aucun mode encore choisi
        // pour cette conversation : rien à décider, on l'applique --
        // voir docstring ci-dessus.
        if (estMineur && rat.length === 1 && !mode.rattachement_id) {
          setModeActifId(rat[0].rattachement_id);
          setChoisi(true);
          setVerrouille(true);
          try {
            await definirModeActif(conversationId, rat[0].rattachement_id);
          } catch {
            // Échec silencieux (même convention que choisir() plus bas) --
            // le blocage serveur (api/chat.py) reste le filet de sécurité réel.
          }
        } else {
          setModeActifId(mode.rattachement_id);
          setChoisi(mode.choisi);
        }

        onAccesBloqueChange?.(estMineur && rat.length === 0);
      })
      .catch(() => {
        // Silencieux (03/09, convention déjà en place pour le contenu
        // accessoire du chat) : l'absence de sélecteur ne doit jamais
        // bloquer la conversation elle-même. Le blocage réel pour un
        // mineur sans code reste appliqué côté serveur (api/chat.py)
        // même si cet affichage échoue.
      })
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function choisir(rattachementId: string | null) {
    if (verrouille) return;
    setOuvert(false);
    // "déjà cet état" doit aussi couvrir "Aucun mode" explicitement choisi
    // (rattachementId===null ET modeActifId===null) séparément de "rien
    // choisi encore" (même valeurs mais choisi===false) -- sinon cliquer
    // sur "Aucun mode" avant tout choix ne ferait jamais rien.
    if (rattachementId === modeActifId && (rattachementId !== null || choisi)) return;
    setEnCours(true);
    const precedent = modeActifId;
    const precedentChoisi = choisi;
    setModeActifId(rattachementId); // optimiste, transition immédiate
    setChoisi(true);
    try {
      await definirModeActif(conversationId, rattachementId);
      if (mineur) setVerrouille(true);
    } catch {
      setModeActifId(precedent); // échec silencieux -- reprend l'affichage précédent
      setChoisi(precedentChoisi);
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) {
    return null; // évite un flash de squelette pour un élément aussi compact et périphérique
  }

  if (rattachements.length === 0) {
    if (!mineur) return null;

    // Mineur sans aucun code rattaché : accès bloqué (Partie 7). Bandeau
    // clair plutôt qu'un badge -- rien à sélectionner ici.
    const bandeau = (
      <div className="flex items-center gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-3 py-2 text-xs text-dj-texte-muet shadow-sm">
        <Lock size={13} className="flex-shrink-0" />
        <span>Entre le code reçu de ton professeur ou établissement pour pouvoir discuter avec Clovis.</span>
      </div>
    );
    return (
      <>
        <div className="fixed inset-x-3 top-[calc(0.5rem+var(--safe-top,0px))] z-40 md:hidden">{bandeau}</div>
        <div className="mb-2 hidden md:flex">{bandeau}</div>
      </>
    );
  }

  const actif = rattachements.find((r) => r.rattachement_id === modeActifId) ?? null;
  const aucunModeChoisi = !actif && choisi;
  const libelle = actif ? actif.nom_code || actif.code : aucunModeChoisi ? "Aucun mode" : "Choisir un mode";

  const pilule = (
    <div className="relative">
      <button
        onClick={() => !verrouille && setOuvert((v) => !v)}
        disabled={enCours || verrouille}
        title={verrouille ? "Mode verrouillé pour cette conversation" : undefined}
        className={`flex items-center gap-1.5 rounded-full border border-dj-bordure bg-dj-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:opacity-60 ${
          actif || aucunModeChoisi ? "text-dj-texte" : "text-dj-texte-muet"
        } ${verrouille ? "cursor-not-allowed" : "hover:bg-dj-surface-haute"}`}
      >
        <span key={libelle} className="max-w-[9rem] truncate animate-dj-fade-in-rapide">
          {libelle}
        </span>
        {verrouille ? (
          <Lock size={11} className="flex-shrink-0" />
        ) : (
          <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`} />
        )}
      </button>

      {ouvert && !verrouille && (
        <div className="dj-scroll-isole absolute right-0 top-9 z-10 max-h-64 w-56 animate-dj-fade-in-rapide overflow-y-auto rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-1 shadow-lg">
          {!mineur && (
            <button
              onClick={() => choisir(null)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
            >
              <span className="min-w-0">
                <span className="block truncate">Aucun mode</span>
                <span className="block truncate text-xs text-dj-texte-muet">Clovis sans code pour cette conversation</span>
              </span>
              {aucunModeChoisi && <Check size={14} className="flex-shrink-0 text-dj-accent-1-texte" />}
            </button>
          )}
          {rattachements.map((r) => (
            <button
              key={r.rattachement_id}
              onClick={() => choisir(r.rattachement_id)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
            >
              <span className="min-w-0">
                <span className="block truncate">{r.nom_code || r.code}</span>
                <span className="block truncate text-xs text-dj-texte-muet">Reçu de {r.proprietaire_nom}</span>
              </span>
              {r.rattachement_id === modeActifId && <Check size={14} className="flex-shrink-0 text-dj-accent-1-texte" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile : position fixe en haut, à droite (le hamburger tiroir
          occupe déjà la gauche à la même hauteur, voir AppSidebar.tsx). */}
      <div className="fixed right-2 top-[calc(0.5rem+var(--safe-top,0px))] z-40 md:hidden">{pilule}</div>

      {/* PC : juste au-dessus de la barre de saisie, alignée à droite. */}
      <div className="mb-2 hidden justify-end md:flex">{pilule}</div>
    </>
  );
}
