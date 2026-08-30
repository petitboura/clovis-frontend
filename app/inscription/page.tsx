"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { inscrireOuConnecter } from "@/lib/authFallback";
import { mettreAJourMonProfil } from "@/lib/api";
import { messageErreur } from "@/lib/erreurs";
import { Logo } from "@/components/Logo";
import { Bouton } from "@/components/Bouton";
import { Skeleton } from "@/components/Skeleton";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";
import { ChampTelephone } from "@/components/ChampTelephone";

type MethodeAuth = "email" | "telephone";

// Refonte du 09/08 (demande explicite Bourama : plus de rôle
// enseignant/étudiant/établissement pour Clovis -- "tu as une IA
// normale, tu es normal, tant que tu n'entres pas un code"). Avant :
// cet écran attribuait silencieusement un rôle "etudiant" à la création
// du compte (creerEtudiantAutonome). Maintenant : aucun rôle à
// attribuer, juste le compte Supabase + le nom enregistré sur le
// profil (mettreAJourMonProfil, endpoint générique déjà partagé, voir
// api/profiles.py:mettre_a_jour_mon_profil) -- puis droit au chat avec
// Clovis.
//
// Garde-fou (10/08, Atik) : app/page.tsx ne redirige plus jamais ici un
// compte déjà connecté sans rôle (il n'y a plus de rôle à vérifier, voir
// EspaceClovis.tsx/app/page.tsx). Si cette page est quand même
// atteinte avec une session active (lien direct, favori), inutile de
// repasser par le formulaire : retour "/" immédiat plus bas.

export default function PageInscription() {
  const router = useRouter();
  const [verificationSession, setVerificationSession] = useState(true);
  const [methode, setMethode] = useState<MethodeAuth>("email");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (annule) return;
      if (session) {
        router.push("/");
        return;
      }
      setVerificationSession(false);
    });
    return () => {
      annule = true;
    };
  }, [router]);

  async function gererSoumission(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { error } =
      methode === "email"
        ? await inscrireOuConnecter({ email, password: motDePasse })
        : await inscrireOuConnecter({ phone: telephone.replace(/\s+/g, ""), password: motDePasse });

    if (error) {
      setEnCours(false);
      setErreur(error.message);
      return;
    }

    // Enregistrement du nom sur le profil -- aucune étape visible, aucun
    // rôle attribué. Si le compte existait déjà (repli "compte existant
    // -> connexion" de inscrireOuConnecter) et avait déjà un nom, ce
    // PATCH l'écrase avec celui tapé ici -- comportement volontairement
    // simple, pas de cas particulier à gérer contrairement à l'ancien
    // ROLE_DEJA_CHOISI (qui n'existe plus, il n'y a plus de rôle).
    try {
      await mettreAJourMonProfil(nom);
    } catch (e) {
      setEnCours(false);
      setErreur(messageErreur(e));
      return;
    }

    setEnCours(false);
    router.push("/");
  }

  if (verificationSession) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm" aria-hidden>
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <Logo taille={32} />
            <span className="font-display text-lg font-bold tracking-tight text-dj-texte">
              <span className="text-dj-accent-1-texte">Clovis</span>
            </span>
          </div>

          <div className="rounded-2xl border border-dj-bordure bg-dj-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
            <Skeleton className="h-6 w-40 rounded-lg" />

            <Skeleton className="mt-4 h-9 rounded-cgpt-bouton" style={{ animationDelay: "80ms" }} />

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <Skeleton className="h-3.5 w-16 rounded" style={{ animationDelay: "160ms" }} />
                <Skeleton className="mt-1.5 h-10 rounded-lg" style={{ animationDelay: "200ms" }} />
              </div>
              <div>
                <Skeleton className="h-3.5 w-16 rounded" style={{ animationDelay: "240ms" }} />
                <Skeleton className="mt-1.5 h-10 rounded-lg" style={{ animationDelay: "280ms" }} />
              </div>
              <div>
                <Skeleton className="h-3.5 w-28 rounded" style={{ animationDelay: "320ms" }} />
                <Skeleton className="mt-1.5 h-10 rounded-lg" style={{ animationDelay: "360ms" }} />
              </div>
              <Skeleton className="h-11 w-full rounded-cgpt-bouton" style={{ animationDelay: "400ms" }} />
            </div>
          </div>

          <Skeleton className="mx-auto mt-5 h-3.5 w-48 rounded" style={{ animationDelay: "440ms" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-dj-fade-up">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo taille={32} />
          <span className="font-display text-lg font-bold tracking-tight text-dj-texte">
            <span className="text-dj-accent-1-texte">Clovis</span>
          </span>
        </div>

        <div className="rounded-2xl border border-dj-bordure bg-dj-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
          <h1 className="font-display text-xl font-bold text-dj-texte">Créer un compte</h1>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-cgpt-bouton border border-dj-bordure bg-dj-surface-haute p-1">
            <button
              type="button"
              onClick={() => setMethode("email")}
              className={`rounded-cgpt-bouton py-1.5 text-sm font-medium transition-colors ${
                methode === "email"
                  ? "bg-dj-accent-1 text-[#1A0D02]"
                  : "text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setMethode("telephone")}
              className={`rounded-cgpt-bouton py-1.5 text-sm font-medium transition-colors ${
                methode === "telephone"
                  ? "bg-dj-accent-1 text-[#1A0D02]"
                  : "text-dj-texte-muet hover:text-dj-texte"
              }`}
            >
              Téléphone
            </button>
          </div>

          <form onSubmit={gererSoumission} className="mt-4 space-y-4">
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-dj-texte-muet">
                Nom
              </label>
              <input
                id="nom"
                type="text"
                required
                autoComplete="name"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-dj-texte outline-none focus:border-dj-bordure-forte"
              />
            </div>

            {methode === "email" ? (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dj-texte-muet">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-dj-texte outline-none focus:border-dj-bordure-forte"
                />
              </div>
            ) : (
              <ChampTelephone id="telephone" value={telephone} onChange={setTelephone} />
            )}

            <ChampMotDePasse
              id="mot-de-passe"
              value={motDePasse}
              onChange={setMotDePasse}
              autoComplete="new-password"
            />

            {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

            <Bouton type="submit" disabled={enCours} className="w-full">
              {enCours ? "Création…" : "Créer mon compte"}
            </Bouton>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-dj-texte-muet">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="text-dj-texte-muet hover:text-dj-texte hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
