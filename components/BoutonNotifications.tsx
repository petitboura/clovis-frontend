"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  listerMesNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
  type NotificationClovis,
} from "@/lib/api";
import { ecouterNotifications } from "@/lib/canalTempsReel";
import { dateRelative } from "@/lib/dateRelative";

// Créé le 02/09/2026, demande Bourama : centre de notifications (bouton
// cloche), ne couvre que les 4 nouveaux types Clovis (voir
// api/notifications.py côté backend -- rappel_echu, action_ia_terminee,
// document_recu_code, message_systeme), pas les anciens types de la
// table notifications (follow/comment/rating/...), laissés de côté pour
// l'instant (décision explicite de Bourama).
//
// Positionné en fixed top-right (miroir du hamburger top-left, voir
// MenuHamburgerWeb.tsx/MenuHamburgerNatif.tsx) : contrairement au
// hamburger, visible aussi bien mobile QUE desktop, il n'y a pas de
// barre du haut dédiée dans cette appli (nav desktop = rail latéral
// AppSidebar.tsx), donc ce bouton EST le header pour ce qui concerne les
// notifications.
//
// Chargement au montage (GET /api/notifications) + mise à jour en
// direct via le canal WebSocket partagé (lib/canalTempsReel.ts,
// ecouterNotifications) quand une notification arrive pendant que
// l'app est ouverte -- voir core/canal_temps_reel.py::notifier_utilisateur
// côté backend.
export function BoutonNotifications({ connecte }: { connecte: boolean }) {
  const [notifications, setNotifications] = useState<NotificationClovis[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const nonLues = notifications.filter((n) => !n.lu).length;

  useEffect(() => {
    if (!connecte) {
      setNotifications([]);
      return;
    }
    let annule = false;
    listerMesNotifications()
      .then((n) => {
        if (!annule) setNotifications(n);
      })
      .catch(() => {
        // Silencieux : un échec de chargement des notifications ne doit
        // jamais bloquer le reste de l'app, même principe que le badge
        // "Plus" ailleurs dans AppSidebar.tsx.
      });
    return () => {
      annule = true;
    };
  }, [connecte]);

  useEffect(() => {
    if (!connecte) return;
    return ecouterNotifications((n) => {
      setNotifications((liste) => [n, ...liste]);
    });
  }, [connecte]);

  useEffect(() => {
    if (!ouvert) return;
    function onClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", onClicExterieur);
    return () => document.removeEventListener("mousedown", onClicExterieur);
  }, [ouvert]);

  if (!connecte) return null;

  async function onClicNotification(n: NotificationClovis) {
    setOuvert(false);
    if (!n.lu) {
      setNotifications((liste) => liste.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
      marquerNotificationLue(n.id).catch(() => {
        // Best effort : au pire, réapparaît non-lue au prochain
        // chargement, jamais bloquant pour la navigation.
      });
    }
    if (n.lien) router.push(n.lien);
  }

  async function onToutMarquerLu() {
    setNotifications((liste) => liste.map((x) => ({ ...x, lu: true })));
    setChargement(true);
    try {
      await marquerToutesNotificationsLues();
    } catch {
      // Best effort, voir onClicNotification.
    } finally {
      setChargement(false);
    }
  }

  return (
    <div ref={ref} className="fixed right-2 top-[calc(0.5rem+var(--safe-top,0px))] z-40">
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-label="Notifications"
        className="group relative flex h-8 w-8 items-center justify-center text-dj-texte"
      >
        <Bell size={22} className="transition-transform duration-200 group-hover:scale-95" />
        {nonLues > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-dj-accent-1 px-1 text-[10px] font-medium leading-none text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-10 w-80 max-w-[calc(100vw-1rem)] animate-dj-fade-in-rapide rounded-cgpt-carte border border-dj-bordure bg-dj-surface shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-dj-bordure px-3 py-2">
            <span className="text-sm font-medium text-dj-texte">Notifications</span>
            {nonLues > 0 && (
              <button
                onClick={onToutMarquerLu}
                disabled={chargement}
                className="text-xs text-dj-texte-muet hover:text-dj-texte disabled:opacity-50"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto p-1">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-dj-texte-muet">Rien de nouveau pour l'instant.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onClicNotification(n)}
                  className={`block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-dj-surface-haute ${
                    n.lu ? "" : "bg-dj-surface-haute/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.lu && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-dj-accent-1" />}
                    <div className={n.lu ? "ml-3.5" : ""}>
                      <p className="text-sm text-dj-texte">{n.titre}</p>
                      {n.contenu && <p className="mt-0.5 text-xs text-dj-texte-muet">{n.contenu}</p>}
                      <p className="mt-1 text-[11px] text-dj-texte-muet">{dateRelative(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
