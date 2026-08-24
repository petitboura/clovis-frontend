"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { connecter } from "@/lib/authFallback";
import { Logo } from "@/components/Logo";
import { Bouton } from "@/components/Bouton";
import { ChampMotDePasse } from "@/components/ChampMotDePasse";
import { ChampTelephone } from "@/components/ChampTelephone";

type MethodeConnexion = "email" | "telephone";

/**
 * Ajouté pour l'écran de consentement OAuth (app/oauth/consent), qui a
 * besoin de renvoyer l'utilisateur non connecté ici puis de le ramener
 * exactement où il était (avec son authorization_id) une fois connecté.
 *
 * Anti-redirection-ouverte : on n'accepte QUE un chemin interne
 * (commence par "/", jamais par "//" ni par un schéma "http(s)://" --
 * "//evil.com" est une URL absolue valide en JS malgré les apparences).
 * Toute valeur qui ne respecte pas ça retombe sur "/".
 */
function cheminRetourSur(valeur: string | null): string {
  if (!valeur) return "/";
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return "/";
  return valeur;
}

// useSearchParams() oblige Next.js à traiter la page en rendu client --
// doit être isolé dans un composant séparé, enveloppé de <Suspense>,
// sinon `next build` échoue ("should be wrapped in a suspense boundary").
export default function PageConnexion() {
  return (
    <Suspense fallback={null}>
      <FormulaireConnexion />
    </Suspense>
  );
}

function FormulaireConnexion() {
  const router = useRouter();
  const params = useSearchParams();
  const retour = cheminRetourSur(params.get("retour"));
  const [methode, setMethode] = useState<MethodeConnexion>("email");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererSoumission(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const { error } =
      methode === "email"
        ? await connecter({ email, password: motDePasse })
        : await connecter({ phone: telephone.replace(/\s+/g, ""), password: motDePasse });

    setEnCours(false);

    if (error) {
      // Supabase renvoie le même message générique pour "mauvais mot de
      // passe" et "aucun compte" (anti-énumération) : on l'affiche tel
      // quel plutôt que d'essayer de deviner lequel des deux c'est.
      setErreur(error.message);
      return;
    }

    router.push(retour);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm animate-dj-fade-up">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo taille={32} />
          <span className="font-display text-lg font-bold tracking-tight text-dj-texte">
            <span className="text-dj-accent-1">Clovis</span>
          </span>
        </div>

        <div className="rounded-2xl border border-dj-bordure bg-dj-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
          <h1 className="font-display text-xl font-bold text-dj-texte">Se connecter</h1>

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

            <ChampMotDePasse id="mot-de-passe" value={motDePasse} onChange={setMotDePasse} />

            {erreur && <p className="text-sm text-[var(--dj-erreur)]">{erreur}</p>}

            <Bouton type="submit" disabled={enCours} className="w-full">
              {enCours ? "Connexion…" : "Se connecter"}
            </Bouton>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-dj-texte-muet">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="text-dj-texte-muet hover:text-dj-texte hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </main>
  );
}
