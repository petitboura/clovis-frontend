import { createClient } from "@supabase/supabase-js";

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

// Un seul client, réutilisé partout — évite de recréer une connexion à
// chaque appel et garde la session (stockée par supabase-js) cohérente
// entre les pages.
export const supabase = createClient(url, cleAnon);

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

    // Ajouté le 30/08/2026, Lot 1 "Exploration de dossier en temps réel" :
    // canal WebSocket bidirectionnel, uniquement côté natif (voir
    // lib/canalTempsReel.ts). Chargé en dynamique comme le reste de ce
    // bloc, pour ne rien exécuter sur le déploiement web (Vercel).
    import("./canalTempsReel").then(({ initialiserCanalTempsReel }) => {
      initialiserCanalTempsReel(registerPlugin);
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
