"use client";

// Petit bus d'événements pour rafraîchir en direct les listes affichées
// quand l'IA modifie les mêmes données depuis le chat (ajouter_programme,
// modifier_chapitre, ajouter_comportement, etc. -- 15/08, demande
// Bourama : "quand l'IA crée un comportement on ne le voit pas"). Les
// composants d'affichage (EspaceProgramme.tsx, EspaceProgrammeContenu.tsx,
// MesComportements.tsx) chargeaient leurs données au montage SEULEMENT,
// aucun mécanisme de rafraîchissement live avant ça. On ne branche pas de
// websocket pour si peu : un simple CustomEvent sur window suffit, émis
// par ChatIA.tsx dès qu'un outil_resultat correspond à une écriture (voir
// PORTEE_PAR_OUTIL ci-dessous).

export type PorteeDonnees = "programme" | "comportements";

const NOM_EVENEMENT = "clovis:donnees_modifiees";

// Mapping nom d'outil MCP -> quelle(s) section(s) frontend rafraîchir.
// Tenu à jour manuellement (pas de génération auto) : un nouvel outil
// d'écriture programme/comportement doit être ajouté ici pour que son
// résultat se voie sans recharger la page.
const PORTEE_PAR_OUTIL: Record<string, PorteeDonnees[]> = {
  ajouter_programme: ["programme"],
  modifier_programme: ["programme"],
  supprimer_programme: ["programme"],
  ajouter_matiere: ["programme"],
  modifier_matiere: ["programme"],
  supprimer_matiere: ["programme"],
  ajouter_chapitre: ["programme"],
  modifier_chapitre: ["programme"],
  supprimer_chapitre: ["programme"],
  ajouter_document_programme: ["programme"],
  modifier_document_programme: ["programme"],
  supprimer_document_programme: ["programme"],
  ajouter_exercice_programme: ["programme"],
  modifier_exercice_programme: ["programme"],
  supprimer_exercice_programme: ["programme"],
  ajouter_examen: ["programme"],
  modifier_examen: ["programme"],
  supprimer_examen: ["programme"],
  // gerer_comportement (consolidé le 26/08, ex ajouter/modifier/
  // supprimer_comportement fusionnés en un seul outil avec un paramètre
  // `action`), se déclenche aussi sur les actions "lister"/"consulter"
  // (lecture seule), coût négligeable comme pour annuler_derniere_modification
  // juste en dessous : un rechargement en trop sur une lecture ne coûte
  // qu'un petit GET, uniquement si la section est déjà montée.
  gerer_comportement: ["comportements"],
  // annule potentiellement l'une ou l'autre selon ce qui a été annulé --
  // on rafraîchit les deux par sécurité, le coût est négligeable (une
  // poignée de petits GET, uniquement si la section est déjà montée).
  annuler_derniere_modification: ["programme", "comportements"],
};

export function emettreDonneesModifieesPourOutil(nomOutil: string) {
  const portees = PORTEE_PAR_OUTIL[nomOutil];
  if (!portees) return;
  for (const portee of portees) {
    window.dispatchEvent(new CustomEvent(NOM_EVENEMENT, { detail: { portee } }));
  }
}

export function ecouterDonneesModifiees(portee: PorteeDonnees, callback: () => void): () => void {
  const gestionnaire = (e: Event) => {
    const detail = (e as CustomEvent<{ portee: PorteeDonnees }>).detail;
    if (detail?.portee === portee) callback();
  };
  window.addEventListener(NOM_EVENEMENT, gestionnaire);
  return () => window.removeEventListener(NOM_EVENEMENT, gestionnaire);
}
