"use client";

import { useEffect, useState } from "react";
import { Check, X as IconRejeter } from "lucide-react";
import { listerSignalements, traiterSignalement, type Signalement } from "@/lib/api";
import { ErreurApi, messageErreur } from "@/lib/erreurs";
import { Skeleton } from "./Skeleton";

// Traitement des signalements (bibliothèque publique + documents
// publics de programme). 22/08, chantier "rendre la bibliothèque plus
// sérieuse". Réservé aux admins (_est_admin côté backend, voir
// api/signalements.py), aucune vérification client-side du rôle ici
// volontairement (pas de mécanisme de rôle exposé côté Clovis, voir
// lib/api.ts) : le 403 renvoyé par l'API est la seule porte, affiché
// tel quel si l'utilisateur courant n'est pas admin.
export function EspaceAdminSignalements() {
  const [liste, setListe] = useState<Signalement[] | undefined>(undefined);
  const [accesRefuse, setAccesRefuse] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enTraitement, setEnTraitement] = useState<string | null>(null);

  function charger() {
    listerSignalements("en_attente")
      .then(setListe)
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 403) {
          setAccesRefuse(true);
        } else {
          setErreur(messageErreur(e));
        }
        setListe([]);
      });
  }

  useEffect(() => {
    charger();
  }, []);

  async function traiter(id: string, action: "retire" | "rejete") {
    setEnTraitement(id);
    try {
      await traiterSignalement(id, action);
      setListe((l) => (l ?? []).filter((s) => s.id !== id));
    } catch (e) {
      window.alert(messageErreur(e));
    } finally {
      setEnTraitement(null);
    }
  }

  if (accesRefuse) {
    return <p className="text-sm text-dj-texte-muet">Réservé aux administrateurs.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

      {liste === undefined && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-20 rounded-xl border border-dj-bordure" />
          <Skeleton className="h-20 rounded-xl border border-dj-bordure" style={{ animationDelay: "100ms" }} />
        </div>
      )}
      {liste?.length === 0 && <p className="text-sm text-dj-texte-muet">Aucun signalement en attente.</p>}
      {liste && liste.length > 0 && (
        <div className="flex flex-col gap-3">
          {liste.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-dj-bordure bg-dj-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-dj-texte">{s.lien_document}</p>
                <span className="flex-shrink-0 rounded-full border border-dj-bordure px-2 py-0.5 text-[11px] text-dj-texte-muet">
                  {s.type_signalement === "bibliotheque_publique" ? "Bibliothèque publique" : "Document de programme"}
                </span>
              </div>
              <p className="text-sm text-dj-texte-muet">{s.motif}</p>
              <p className="text-xs text-dj-texte-muet">
                Signalé par {s.plaignant_nom} ({s.plaignant_email})
                {s.plaignant_organisation ? ` — ${s.plaignant_organisation}` : ""}
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => traiter(s.id, "rejete")}
                  disabled={enTraitement === s.id}
                  className="flex items-center gap-1 rounded-cgpt-bouton border border-dj-bordure px-3 py-1.5 text-xs text-dj-texte-muet transition-colors hover:border-dj-bordure-forte disabled:opacity-50"
                >
                  <IconRejeter size={13} /> Rejeter
                </button>
                <button
                  onClick={() => traiter(s.id, "retire")}
                  disabled={enTraitement === s.id}
                  className="flex items-center gap-1 rounded-cgpt-bouton bg-[var(--dj-erreur)] px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                >
                  <Check size={13} /> Retirer le contenu
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
