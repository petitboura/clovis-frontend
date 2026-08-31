"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { appelerApi } from "@/lib/api";
import { messageErreur } from "./erreurs";

// CORRIGÉ le 24/07/2026 (Bourama : "quand tu envoies un premier message
// ça marche, dans mon profil ça marche, le problème vient du bouton").
// Cause réelle : chaque composant (cloche, profil, ChatIA) appelait
// useNotificationsPush() avec son PROPRE useState local -- 3 mémoires
// indépendantes qui ne se parlent jamais. Résultat : s'abonner via le
// chat ne prévenait jamais la cloche, qui restait affichée avec un
// état périmé. Cliquer dessus semblait "ne rien faire" (en réalité :
// la permission était déjà accordée ailleurs, donc le navigateur ne
// redemande rien -- comportement normal -- mais la cloche ne se
// mettait jamais à jour pour le refléter).
//
// Fix : un seul état partagé (module-level), tous les composants qui
// utilisent ce hook s'abonnent au même store et se mettent à jour
// ensemble, quel que soit celui qui a déclenché le changement.

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(base64);
  const tableau = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) tableau[i] = brut.charCodeAt(i);
  return tableau;
}

export type EtatNotificationsPush =
  | "verification"
  | "indisponible"
  | "service_worker_bloque"
  | "refuse"
  | "inactif"
  | "actif"
  | "changement";

// --- Store partagé minimal (pas besoin d'une lib externe pour ça) ---
let etatPartage: EtatNotificationsPush = "verification";
let erreurPartagee: string | null = null;
const abonnes = new Set<() => void>();

function notifierTousLesAbonnes() {
  abonnes.forEach((notifier) => notifier());
}

function definirEtat(nouvelEtat: EtatNotificationsPush) {
  etatPartage = nouvelEtat;
  notifierTousLesAbonnes();
}

function definirErreur(nouvelleErreur: string | null) {
  erreurPartagee = nouvelleErreur;
  notifierTousLesAbonnes();
}

async function verifierEtatPartage() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    definirEtat("indisponible");
    return;
  }
  if (Notification.permission === "denied") {
    definirEtat("refuse");
    return;
  }
  try {
    // Timeout de sécurité : navigator.serviceWorker.ready peut ne jamais
    // se résoudre si l'enregistrement du service worker échoue/traîne.
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    const abonnementExistant = await registration.pushManager.getSubscription();
    definirEtat(abonnementExistant ? "actif" : "inactif");
  } catch {
    definirEtat("service_worker_bloque");
  }
}

async function activerPartage(): Promise<boolean> {
  definirErreur(null);
  definirEtat("changement");
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      definirEtat(permission === "denied" ? "refuse" : "inactif");
      return false;
    }

    // Si un AUTRE composant a déjà terminé l'abonnement entre-temps
    // (ex: double-clic, ou un autre onglet), getSubscription() renvoie
    // l'abonnement existant au lieu d'en recréer un pour rien.
    const registration = await navigator.serviceWorker.ready;
    const abonnementExistant = await registration.pushManager.getSubscription();
    if (abonnementExistant) {
      definirEtat("actif");
      return true;
    }

    const { cle_publique } = await appelerApi("/api/notifications-push/cle-publique");
    const abonnement = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cle_publique),
    });

    await appelerApi("/api/notifications-push/abonnement", {
      method: "POST",
      body: JSON.stringify(abonnement.toJSON()),
    });

    definirEtat("actif");
    return true;
  } catch (e) {
    definirErreur(messageErreur(e));
    definirEtat("inactif");
    return false;
  }
}

async function desactiverPartage() {
  definirErreur(null);
  definirEtat("changement");
  try {
    const registration = await navigator.serviceWorker.ready;
    const abonnement = await registration.pushManager.getSubscription();
    if (abonnement) {
      await appelerApi("/api/notifications-push/desabonnement", {
        method: "POST",
        body: JSON.stringify({ endpoint: abonnement.endpoint }),
      });
      await abonnement.unsubscribe();
    }
    definirEtat("inactif");
  } catch (e) {
    definirErreur(messageErreur(e));
    definirEtat("actif");
  }
}

export function useNotificationsPush() {
  // Chaque composant garde un useState local, mais UNIQUEMENT pour
  // déclencher son propre re-render -- la valeur vient toujours du
  // store partagé ci-dessus, jamais d'un état indépendant.
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const notifier = () => forceRerender((n) => n + 1);
    abonnes.add(notifier);
    // Si c'est le tout premier composant monté, lance la vérification
    // initiale. Les suivants profitent directement de l'état déjà connu.
    if (abonnes.size === 1 && etatPartage === "verification") {
      verifierEtatPartage();
    }
    return () => {
      abonnes.delete(notifier);
    };
  }, []);

  return {
    etat: etatPartage,
    erreur: erreurPartagee,
    activer: activerPartage,
    desactiver: desactiverPartage,
    verifierEtat: verifierEtatPartage,
  };
}

// Déclenchement automatique sur la toute première action réelle (envoi
// de message, création d'IA...) -- demande explicite de Bourama
// (2026-07-22) : "dès que tu ouvre, permission demandé ... comme
// utiliser une ia, ou appui sur créer son IA". Un seul essai automatique
// EVER par appareil (pas par session) : redemander à chaque message si
// la personne a ignoré la popup native serait très intrusif. Le bouton
// cloche/profil reste toujours disponible pour réessayer manuellement
// ensuite, quel que soit ce flag.
const CLE_DEJA_PROPOSE = "djiguigne_notif_push_proposee";

export function proposerNotificationsPushUneFois(activer: () => Promise<boolean>) {
  if (typeof window === "undefined") return;
  // Correctif du 31/08/2026 (Bourama : "le chat n'envoie plus rien sur
  // l'app installée, message effacé mais rien n'apparaît, aucune erreur
  // visible"). Cause réelle : ce système est celui des notifications Push
  // du NAVIGATEUR (Web Push API), pensé pour le site dans un onglet Chrome.
  // L'app installée (WebView Capacitor) a son propre canal séparé et déjà
  // câblé pour les notifications natives (Firebase, voir
  // ClovisFirebaseMessagingService.kt côté Android) -- ce système web n'a
  // rien à faire là. Or la WebView Capacitor ne fournit pas l'objet
  // `Notification` du navigateur : la ligne plus bas y accédait sans
  // protection, plantait silencieusement (aucun catch, appelée sans await
  // depuis BarreDeSaisie.tsx), avant même que le message de l'utilisateur
  // soit affiché à l'écran ou qu'une requête parte vers le backend. Sortie
  // immédiate en natif, avant tout accès à `Notification`.
  if (Capacitor.isNativePlatform()) return;
  if (window.localStorage.getItem(CLE_DEJA_PROPOSE)) return;
  if (Notification.permission !== "default") return; // déjà répondu avant
  window.localStorage.setItem(CLE_DEJA_PROPOSE, "true");
  activer();
}
