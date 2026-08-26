"use client";

import { Hourglass } from "lucide-react";

// Créé le 26/08/2026, Bourama : refonte navigation mobile native.
//
// Placeholder volontaire : le plugin natif ControleSessionPlugin.kt
// (voir MainActivity.java / lib/supabase.ts) est déjà enregistré côté
// natif, mais sans écran côté web -- voir /areas/clovis.md pour le détail
// des méthodes exposées (permissionAccordee, ouvrirReglagesPermission,
// demarrerSession, arreterSession). Portée du chantier actuel = poser la
// barre d'onglets et réserver la place de cet onglet, PAS construire son
// contenu (décision explicite de Bourama, 26/08 : "tu ne va pas
// construire des interface non existant"). Le vrai écran (Lot 4 mobile)
// remplacera ce composant.
export function EspaceControleSessionBientotDisponible() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Hourglass size={28} className="text-dj-texte-muet" />
      <div className="text-sm font-medium text-dj-texte">Bientôt disponible</div>
      <div className="max-w-xs text-xs text-dj-texte-muet">
        Le contrôle de session (démarrer/arrêter une session, gérer la permission) arrive dans une prochaine mise à jour.
      </div>
    </div>
  );
}
