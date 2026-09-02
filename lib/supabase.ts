import { createClient } from "@supabase/supabase-js";
import type { LockFunc } from "@supabase/supabase-js";

// Décision d'architecture (voir api/PLAN.md, point 1) : Next.js parle
// DIRECTEMENT à Supabase Auth via ce client JS. Le backend FastAPI ne gère
// jamais de mot de passe — il ne fait que vérifier le token envoyé.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cleAnon) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis (voir .env.local.example)."
  );
}

// Correctif du 31/08/2026 (Bourama : "le chat ne répond pas sur l'appli
// installée, rien du tout, ni côté serveur ni erreur affichée") :
// supabase-js utilise par défaut navigator.locks (Web Locks API) pour
// sérialiser les appels d'auth (getSession, refresh...) entre onglets.
// Sur certaines WebView natives (Capacitor/Android), ce verrou peut
// rester bloqué indéfiniment sans jamais rejeter la promesse -- l'appel
// `await supabase.auth.getSession()` dans appelerApiStream (lib/api.ts)
// ne se termine alors jamais, donc AUCUNE requête ne part vers
// clovis-backend et aucune erreur n'est levée (bug connu, ex.
// supabase/supabase-js#1594, #2013 -- pas propre à ce dépôt). Ici, une
// seule WebView par appareil (pas de multi-onglets à coordonner comme
// sur le web) : un simple verrou en mémoire suffit et ne peut pas rester
// bloqué au-delà de la fonction elle-même.
const verrouEnMemoire: LockFunc = async (_nom, _delaiAcquisition, fn) => {
  return await fn();
};

// Un seul client, réutilisé partout — évite de recréer une connexion à
// chaque appel et garde la session (stockée par supabase-js) cohérente
// entre les pages.
export const supabase = createClient(url, cleAnon, {
  auth: {
    lock: verrouEnMemoire,
  },
});

// Ajouté le 30/08/2026, Lot 1 "Exploration de dossier en temps réel" ;
// modifié le 02/09/2026 (Bourama, centre de notifications -- bouton
// cloche) : canal WebSocket bidirectionnel, désormais ouvert web ET
// natif (voir lib/canalTempsReel.ts). Avant cette date, uniquement
// natif car seule l'exploration de dossier (native only) en avait
// besoin ; le centre de notifications doit fonctionner sur les deux.
if (typeof window !== "undefined") {
  import("./canalTempsReel").then(({ initialiserCanalTempsReel }) => {
    initialiserCanalTempsReel();
  });
}

// Ajouté le 25/08/2026, Bourama : Lot 3B (fusion Capacitor) -- transmet le
// token d'accès au plugin natif PontNatif à chaque connexion/déconnexion/
// rafraîchissement, pour que le service FCM côté Android puisse appeler
// clovis-backend même app fermée (voir android/app/.../pont/StockageToken.kt
// pour le pourquoi : pas de deuxième auth native séparée, uniquement ce
// pont). Capacitor.isNativePlatform() : ce code ne fait rien sur le
// déploiement web normal (Vercel), où le plugin n'existe pas.
if (typeof window !== "undefined") {
  import("@capacitor/core").then(({ Capacitor, registerPlugin }) => {
    if (!Capacitor.isNativePlatform()) return;

    // Plugin Dossiers : uniquement utile côté natif (exploration de
    // dossier sur le téléphone), voir lib/canalTempsReel.ts.
    import("./canalTempsReel").then(({ enregistrerPluginDossiers }) => {
      enregistrerPluginDossiers(registerPlugin);
    });

    const PontNatif = registerPlugin<{
      enregistrerToken(options: { token: string }): Promise<void>;
      deconnexion(): Promise<void>;
      rattraperActionsEnAttente(): Promise<{ traitees: number }>;
    }>("PontNatif");

    // Ajouté le 26/08/2026 : filet de secours pour les actions dont le
    // push (FCM/APNs) n'est jamais arrivé (app tuée, hors ligne...),
    // voir PontNatifPlugin.kt/.swift, jamais appelé nulle part avant ce
    // correctif. Une seule fois par ouverture d'app (ce module ne se
    // recharge qu'au relancement complet de la WebView), pas à chaque
    // rafraîchissement de token (~1h) : `dejaRattrape` l'empêche.
    let dejaRattrape = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        PontNatif.enregistrerToken({ token: session.access_token }).catch(() => {
          // Pas grave : le pont retentera au prochain changement d'état
          // (refresh de token automatique par supabase-js, ~1h).
        });
        if (!dejaRattrape) {
          dejaRattrape = true;
          PontNatif.rattraperActionsEnAttente().catch(() => {
            // Pas grave : le prochain push (ou la prochaine ouverture)
            // rattrapera l'action en attente.
          });
        }
      } else if (event === "SIGNED_OUT") {
        PontNatif.deconnexion().catch(() => {});
        dejaRattrape = false;
      }
    });
  });
}
