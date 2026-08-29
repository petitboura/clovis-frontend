import Link from "next/link";
import { Download, ShieldCheck, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Bouton } from "@/components/Bouton";

// Page publique de téléchargement de l'APK "externe" (hors Play Store).
// Créée le 29/08/2026, mission Bourama : combiner une page web dédiée +
// le système de mise à jour interne existant (voir MiseAJourCarte.tsx /
// VerificateurMiseAJour.kt, tous deux déjà branchés sur l'API publique
// GitHub Releases, corrigée le même jour pour pointer sur ce dépôt
// clovis-frontend plutôt que l'ancien clovis-mobile).
//
// Composant serveur volontairement : cette page n'est PAS incluse dans
// l'export statique Capacitor (CAPACITOR_BUILD), elle vit uniquement sur
// le déploiement web normal (Vercel), donc rien n'empêche un fetch côté
// serveur -- voir next.config.mjs pour la logique conditionnelle.
//
// Pas de mécanisme i18n branché ici, comme MiseAJourCarte.tsx : textes en
// dur en français, cohérent avec le reste du projet à ce stade.

const URL_DERNIERE_RELEASE = "https://api.github.com/repos/petitboura/clovis-frontend/releases/latest";

// Une release GitHub peut contenir des assets qui ne sont pas l'APK
// (source zip, changelog...), donc on prend explicitement celui qui finit
// par .apk -- même règle que VerificateurMiseAJour.kt côté app, pour ne
// jamais désynchroniser les deux logiques.
type AssetGitHub = { name: string; browser_download_url: string; size: number };
type ReleaseGitHub = {
  tag_name: string;
  html_url: string;
  published_at: string;
  body?: string;
  assets: AssetGitHub[];
};

async function recupererDerniereRelease(): Promise<ReleaseGitHub | null> {
  try {
    // revalidate : évite de taper l'API GitHub à chaque visite (limite de
    // taux basse sans authentification), une heure est amplement assez
    // pour une page de téléchargement.
    const reponse = await fetch(URL_DERNIERE_RELEASE, { next: { revalidate: 3600 } });
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch {
    return null;
  }
}

function formatTaille(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function PageTelecharger() {
  const release = await recupererDerniereRelease();
  const apk = release?.assets.find((a) => a.name.endsWith(".apk")) ?? null;
  const version = release?.tag_name.replace(/^v/, "") ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg animate-dj-fade-up">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo taille={32} />
          <span className="font-display text-lg font-bold tracking-tight text-dj-texte">Clovis</span>
        </div>

        <div className="rounded-2xl border border-dj-bordure bg-dj-surface p-6 shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
          <h1 className="font-display text-xl font-bold text-dj-texte">Télécharger Clovis pour Android</h1>
          <p className="mt-2 text-sm text-dj-texte-muet">
            Cette version est distribuée directement en dehors du Google Play Store, avec les
            fonctionnalités avancées de contrôle de l&apos;appareil (accessibilité).
          </p>

          <div className="mt-5 rounded-xl border border-dj-bordure bg-dj-surface-haute p-4">
            {apk && version ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium text-dj-texte">Version {version}</span>
                    <span className="block text-xs text-dj-texte-muet">{formatTaille(apk.size)}</span>
                  </div>
                </div>
                <a href={apk.browser_download_url} className="mt-4 block">
                  <Bouton className="flex w-full items-center justify-center gap-2">
                    <Download size={16} />
                    Télécharger l&apos;APK
                  </Bouton>
                </a>
                {release?.html_url && (
                  <Link
                    href={release.html_url}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs text-dj-texte-muet hover:text-dj-texte hover:underline"
                  >
                    Voir les notes de version
                    <ExternalLink size={12} />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-dj-texte-muet">
                Aucune version n&apos;est disponible au téléchargement pour le moment.
              </p>
            )}
          </div>

          <div className="mt-5 flex items-start gap-2.5 text-xs text-dj-texte-muet">
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
            <p>
              Android bloque par défaut l&apos;installation d&apos;applications venant d&apos;ailleurs que le
              Play Store. Après le téléchargement, ouvre le fichier et autorise l&apos;installation
              depuis cette source si le téléphone te le demande. L&apos;application vérifie
              elle-même si une mise à jour est disponible une fois installée.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
