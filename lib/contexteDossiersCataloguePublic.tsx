"use client";

import { createContext, useCallback, useContext, useState, type Dispatch, type SetStateAction } from "react";
import {
  listerDossiersCataloguePublic,
  listerDossiersPublicsAttaches,
  type DossierCataloguePublic,
} from "@/lib/api";

// Créé le 09/09/2026, demande Bourama : les dossiers de la bibliothèque
// publique (+ la liste de ceux déjà attachés à la bibliothèque perso,
// pour les badges Attaché/Détaché) doivent être chargés dès l'ouverture
// de l'app, en arrière-plan -- pour que BibliothequePublique.tsx les
// affiche instantanément à l'ouverture de la section au lieu d'attendre
// son propre montage. Même principe que ContexteChat/ContexteFenetres
// (lib/contexteChat.tsx) : AppShell est seul fournisseur, monté une
// seule fois, jamais démonté en changeant de section.
//
// AppShell déclenche rafraichirDossiers()/rafraichirDossiersAttaches()
// dès que la session est confirmée (voir AppShell.tsx). BibliothequePublique.tsx
// les rappelle en silence à chaque montage de la section pour rester à
// jour (confirmé par Bourama, 09/09/2026) -- le préchargement s'affiche
// instantanément, la version à jour le remplace en douceur si elle
// diffère, jamais de nouveau skeleton pour cette seconde requête.
type ContexteDossiersCataloguePublicValeur = {
  dossiers: DossierCataloguePublic[] | undefined;
  dossiersAttachesIds: Set<string>;
  setDossiersAttachesIds: Dispatch<SetStateAction<Set<string>>>;
  rafraichirDossiers: () => void;
  rafraichirDossiersAttaches: () => void;
};

export const ContexteDossiersCataloguePublic = createContext<ContexteDossiersCataloguePublicValeur | null>(null);

export function useFournirDossiersCataloguePublic() {
  const [dossiers, setDossiers] = useState<DossierCataloguePublic[] | undefined>(undefined);
  const [dossiersAttachesIds, setDossiersAttachesIds] = useState<Set<string>>(new Set());

  const rafraichirDossiers = useCallback(() => {
    listerDossiersCataloguePublic()
      .then(setDossiers)
      // Un rafraîchissement silencieux qui échoue (déjà ouvert, session
      // qui vient d'expirer, etc.) ne doit jamais effacer un
      // préchargement déjà réussi -- seul le tout premier chargement
      // retombe sur [] pour sortir de l'état "undefined" (skeleton).
      .catch(() => setDossiers((precedent) => precedent ?? []));
  }, []);

  const rafraichirDossiersAttaches = useCallback(() => {
    listerDossiersPublicsAttaches()
      .then((liste) => setDossiersAttachesIds(new Set(liste.map((d) => d.id))))
      .catch(() => {});
  }, []);

  return { dossiers, dossiersAttachesIds, setDossiersAttachesIds, rafraichirDossiers, rafraichirDossiersAttaches };
}

export function useDossiersCataloguePublic() {
  const ctx = useContext(ContexteDossiersCataloguePublic);
  if (!ctx) {
    throw new Error("useDossiersCataloguePublic doit être utilisé sous ContexteDossiersCataloguePublic.Provider (voir AppShell.tsx)");
  }
  return ctx;
}
