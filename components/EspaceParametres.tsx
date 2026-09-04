"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  SlidersHorizontal,
  Lock,
  HelpCircle,
  Info,
  Trash2,
  Download,
  Camera,
  Monitor,
  Sun,
  Moon,
  MessageCircle,
  Smartphone,
  Accessibility,
  type LucideIcon,
} from "lucide-react";
import { BoutonRetour } from "./BoutonRetour";
import { ChampMotDePasse } from "./ChampMotDePasse";
import { supabase } from "@/lib/supabase";
import { appelerApiFichier, lireMonProfil, enregistrerMonProfil, supprimerMonCompte, exporterMesDonnees } from "@/lib/api";
import { messageErreur, ErreurApi } from "@/lib/erreurs";
import { useTheme, type ChoixTheme } from "@/lib/useTheme";
import { Skeleton } from "./Skeleton";
import { CTACompteRequis } from "./CTACompteRequis";
import { ConnecteurNotionCarte } from "./ConnecteurNotionCarte";
import { MiseAJourCarte } from "./MiseAJourCarte";
import { RUBRIQUES_AIDE, trouverRubriqueAide, type RubriqueAide } from "@/lib/aideSections";
import { EspaceAccessibilite } from "./EspaceAccessibilite";

/**
 * Page Paramètres (22/08/2026, demande Bourama).
 *
 * CORRECTIF (22/08/2026, v2) -- la première version empilait 6 gros blocs
 * éditables directement sur la page ("ça ressemble à rien", retour de
 * Bourama). Refaite en vraie liste après avoir regardé de vraies captures
 * (réglages iOS/Android) : une liste de lignes cliquables (icône +
 * libellé + chevron), chaque ligne ouvre son propre écran. Pas de route
 * Next.js par écran -- même pattern que le drill-down programme -> matière
 * -> chapitre dans EspaceProgramme.tsx (état interne `vue` + bouton
 * retour), pour rester cohérent avec l'existant plutôt que d'inventer un
 * système de routes.
 *
 * "Se déconnecter" n'est plus dans cette page : accessible depuis le menu
 * qui s'ouvre au clic sur la photo de profil dans la sidebar (voir
 * AppSidebar.tsx:MenuProfil), pas la peine de le dupliquer ici.
 *
 * Rôles (2026-08-04) volontairement absents : voir app/inscription/page.tsx,
 * l'inscription n'attribue plus aucun rôle.
 *
 * Deux sections minimales par manque de contenu réel (signalé à Bourama
 * plutôt qu'inventé) : Aide et support (pas d'adresse dédiée trouvée dans
 * le projet), À propos (pas de CGU propres à Clovis, liens vers les pages
 * légales déjà en ligne sur la vitrine).
 *
 * Pas de mécanisme i18n branché ici (même constat que MesComportements.tsx
 * et EspacePlugins.tsx) -- textes en dur en français.
 */

type Vue = "liste" | "profil" | "preferences" | "confidentialite" | "aide" | "a-propos" | "capacites-telephone" | "accessibilite";

type ProfilMoi = {
  user_id: string;
  nom_affiche: string;
  bio: string;
  avatar_url: string | null;
  notifications_proactives_actives: boolean;
};

const ORDRE_THEME: ChoixTheme[] = ["systeme", "clair", "sombre"];
const ICONES_THEME = { systeme: Monitor, clair: Sun, sombre: Moon };
const LIBELLES_THEME = { systeme: "Système", clair: "Clair", sombre: "Sombre" };

function EnTete({ titre, onRetour }: { titre: string; onRetour: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <BoutonRetour onClick={onRetour} />
      <h2 className="font-display text-base font-bold text-dj-texte">{titre}</h2>
    </div>
  );
}

function Liste({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
      <div className="divide-y divide-dj-bordure">{children}</div>
    </div>
  );
}

function LigneListe({
  icone: Icone,
  titre,
  sousTitre,
  onClick,
  danger = false,
}: {
  icone: LucideIcon;
  titre: string;
  sousTitre?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
    >
      <Icone size={18} className={danger ? "flex-shrink-0 text-[var(--dj-erreur)]" : "flex-shrink-0 text-dj-texte-muet"} />
      <div className="flex-1 overflow-hidden">
        <div className={`truncate text-sm ${danger ? "text-[var(--dj-erreur)]" : "text-dj-texte"}`}>{titre}</div>
        {sousTitre && <div className="truncate text-xs text-dj-texte-muet">{sousTitre}</div>}
      </div>
      {!danger && <ChevronRight size={16} className="flex-shrink-0 text-dj-texte-muet" />}
    </button>
  );
}

// Une rubrique de la page "Aide et support" -- repliee par defaut,
// depliee soit au clic, soit automatiquement quand on arrive via le lien
// "En savoir plus" d'une bulle infotip (?aide=<id>, voir plus haut). Dans
// ce dernier cas, on scrolle aussi jusqu'a elle pour qu'elle soit visible
// sans que l'utilisateur ait a chercher dans la liste.
function RubriqueAideDepliable({
  rubrique,
  ouverte,
  onToggle,
}: {
  rubrique: RubriqueAide;
  ouverte: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ouverte) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ouverte]);

  return (
    <div ref={ref}>
      <button
        onClick={onToggle}
        aria-expanded={ouverte}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-dj-surface-haute"
      >
        <span className="text-sm text-dj-texte">{rubrique.titre}</span>
        <ChevronRight size={16} className={`flex-shrink-0 text-dj-texte-muet transition-transform ${ouverte ? "rotate-90" : ""}`} />
      </button>
      {ouverte && (
        <p className="animate-dj-fade-in-rapide px-4 pb-3 text-xs leading-relaxed text-dj-texte-muet">
          {rubrique.texteComplet}
        </p>
      )}
    </div>
  );
}


export function EspaceParametres() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { choix: choixTheme, changerTheme } = useTheme();

  const [vue, setVue] = useState<Vue>("liste");
  const [rubriqueAideOuverte, setRubriqueAideOuverte] = useState<string | null>(null);

  useEffect(() => {
    const idRubrique = searchParams.get("aide");
    if (idRubrique && trouverRubriqueAide(idRubrique)) {
      setVue("aide");
      setRubriqueAideOuverte(idRubrique);
      return;
    }
    // 04/09/2026 : ouvre directement la section Profil (photo/nom/bio)
    // quand on arrive depuis "Voir le profil" (AppSidebar.tsx,
    // MenuProfil), au lieu de retomber sur la liste générale.
    if (searchParams.get("vue") === "profil") {
      setVue("profil");
    }
  }, [searchParams]);

  const [chargement, setChargement] = useState(true);
  const [sansCompte, setSansCompte] = useState(false);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [profil, setProfil] = useState<ProfilMoi | null>(null);
  const [nomAffiche, setNomAffiche] = useState("");
  const [bio, setBio] = useState("");
  const [notifsActives, setNotifsActives] = useState(false);

  const [enregistrementProfil, setEnregistrementProfil] = useState(false);
  const [messageProfil, setMessageProfil] = useState<string | null>(null);
  const [erreurProfil, setErreurProfil] = useState<string | null>(null);

  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [erreurAvatar, setErreurAvatar] = useState<string | null>(null);
  const inputFichierRef = useRef<HTMLInputElement>(null);

  const [messageNotifs, setMessageNotifs] = useState<string | null>(null);
  const [enregistrementNotifs, setEnregistrementNotifs] = useState(false);

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState("");
  const [enregistrementMotDePasse, setEnregistrementMotDePasse] = useState(false);
  const [messageMotDePasse, setMessageMotDePasse] = useState<string | null>(null);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null);

  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  useEffect(() => {
    lireMonProfil()
      .then((p: ProfilMoi) => {
        setProfil(p);
        setNomAffiche(p.nom_affiche || "");
        setBio(p.bio || "");
        setNotifsActives(!!p.notifications_proactives_actives);
      })
      .catch((e) => {
        if (e instanceof ErreurApi && e.statusCode === 401) {
          setSansCompte(true);
        } else {
          setErreurChargement(messageErreur(e));
        }
      })
      .finally(() => setChargement(false));
  }, []);

  async function enregistrerProfil() {
    setEnregistrementProfil(true);
    setErreurProfil(null);
    setMessageProfil(null);
    try {
      await enregistrerMonProfil({ nom_affiche: nomAffiche.trim(), bio: bio.trim() });
      setMessageProfil("Profil enregistré.");
    } catch (e) {
      setErreurProfil(messageErreur(e));
    } finally {
      setEnregistrementProfil(false);
    }
  }

  async function changerAvatar(fichier: File) {
    setUploadEnCours(true);
    setErreurAvatar(null);
    try {
      const { url } = await appelerApiFichier("/api/uploads/image", fichier);
      await enregistrerMonProfil({ avatar_url: url });
      setProfil((p) => (p ? { ...p, avatar_url: url } : p));
    } catch (e) {
      setErreurAvatar(messageErreur(e));
    } finally {
      setUploadEnCours(false);
    }
  }

  async function basculerNotifs() {
    const nouvelleValeur = !notifsActives;
    setNotifsActives(nouvelleValeur);
    setEnregistrementNotifs(true);
    setMessageNotifs(null);
    try {
      await enregistrerMonProfil({ notifications_proactives_actives: nouvelleValeur });
      setMessageNotifs(nouvelleValeur ? "Relances activées." : "Relances désactivées.");
    } catch (e) {
      setNotifsActives(!nouvelleValeur);
      setMessageNotifs(messageErreur(e));
    } finally {
      setEnregistrementNotifs(false);
    }
  }

  async function changerMotDePasse(e: React.FormEvent) {
    e.preventDefault();
    setErreurMotDePasse(null);
    setMessageMotDePasse(null);
    if (motDePasse.length < 6) {
      setErreurMotDePasse("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (motDePasse !== confirmationMotDePasse) {
      setErreurMotDePasse("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setEnregistrementMotDePasse(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      setMessageMotDePasse("Mot de passe mis à jour.");
      setMotDePasse("");
      setConfirmationMotDePasse("");
    } catch (e: any) {
      setErreurMotDePasse(e?.message || "Impossible de mettre à jour le mot de passe, réessaie.");
    } finally {
      setEnregistrementMotDePasse(false);
    }
  }

  async function handleExporterMesDonnees() {
    setExportEnCours(true);
    setErreurExport(null);
    try {
      await exporterMesDonnees();
    } catch (e) {
      setErreurExport(messageErreur(e));
    } finally {
      setExportEnCours(false);
    }
  }

  async function confirmerSuppressionCompte() {
    const saisie = window.prompt(
      'Cette action est définitive : ton profil, tes IA, tes commentaires et tout ce qui t\'appartient sur Clovis seront supprimés. Tape "SUPPRIMER" pour confirmer.'
    );
    if (saisie !== "SUPPRIMER") return;

    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await supprimerMonCompte();
      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
      setErreurSuppression(messageErreur(e));
      setSuppressionEnCours(false);
    }
  }

  if (sansCompte) {
    return <CTACompteRequis texte="Crée un compte pour gérer ton profil et tes préférences." />;
  }

  if (chargement) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        {/* Carte profil -- avatar rond + nom + sous-titre + chevron */}
        <div className="flex w-full items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3.5">
          <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full border border-dj-bordure" />
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
          </div>
          <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
        </div>

        {/* Groupe 1 -- Préférences / Confidentialité et sécurité / Aide et support / À propos */}
        <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <div className="divide-y divide-dj-bordure">
            {["w-24", "w-44", "w-28", "w-16"].map((largeur, i) => (
              <div key={i} className="flex w-full items-center gap-3 px-4 py-3">
                <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
                <div className="flex-1 overflow-hidden">
                  <Skeleton className={`h-3.5 ${largeur} rounded`} />
                </div>
                <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Groupe 2 -- Capacités du téléphone (titre + sous-titre) / Accessibilité (titre seul) */}
        <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <div className="divide-y divide-dj-bordure">
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
              <div className="flex-1 overflow-hidden">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-36 rounded" />
                  <Skeleton className="h-2.5 w-32 rounded" />
                </div>
              </div>
              <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
            </div>
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
              <div className="flex-1 overflow-hidden">
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
            </div>
          </div>
        </div>

        {/* Groupe 3 -- Supprimer mon compte (danger, pas de chevron dans le vrai contenu) */}
        <div className="overflow-hidden rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <Skeleton className="h-[18px] w-[18px] flex-shrink-0 rounded" />
            <div className="flex-1 overflow-hidden">
              <Skeleton className="h-3.5 w-32 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (erreurChargement) {
    return <p className="text-sm text-[var(--dj-erreur)]">{erreurChargement}</p>;
  }

  const libelleProfil = nomAffiche || "Mon compte";

  // --- Liste principale ------------------------------------------------
  if (vue === "liste") {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setVue("profil")}
          className="flex w-full items-center gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface px-4 py-3.5 text-left transition-colors hover:bg-dj-surface-haute"
        >
          <span className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-dj-bordure bg-dj-surface-haute">
            {profil?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar_url vient de Supabase Storage
              <img src={profil.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-base font-bold text-dj-texte-muet">
                {libelleProfil.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm font-medium text-dj-texte">{libelleProfil}</div>
            <div className="truncate text-xs text-dj-texte-muet">Photo, nom, bio</div>
          </div>
          <ChevronRight size={16} className="flex-shrink-0 text-dj-texte-muet" />
        </button>

        <Liste>
          <LigneListe icone={SlidersHorizontal} titre="Préférences" onClick={() => setVue("preferences")} />
          <LigneListe icone={Lock} titre="Confidentialité et sécurité" onClick={() => setVue("confidentialite")} />
          <LigneListe icone={HelpCircle} titre="Aide et support" onClick={() => setVue("aide")} />
          <LigneListe icone={Info} titre="À propos" onClick={() => setVue("a-propos")} />
        </Liste>

        {/* Groupe "Capacités du téléphone" + Accessibilité (26/08/2026,
            décision Bourama, voir /areas/clovis.md) -- plugins natifs
            Capacitor sans écran jusqu'ici. Chaque carte/écran gère déjà
            son propre état "disponible seulement sur mobile"
            (usePluginNatif), donc rien à faire ici pour le web : ces
            deux lignes restent visibles mais mènent à un contenu qui
            explique lui-même l'indisponibilité sur le site. */}
        <Liste>
          <LigneListe icone={Smartphone} titre="Capacités du téléphone" sousTitre="Connecteurs, mise à jour" onClick={() => setVue("capacites-telephone")} />
          <LigneListe icone={Accessibility} titre="Accessibilité" onClick={() => setVue("accessibilite")} />
        </Liste>

        <Liste>
          <LigneListe
            icone={Download}
            titre={exportEnCours ? "Export en cours…" : "Exporter mes données"}
            sousTitre="Télécharger une copie de tout ce que Clovis sait sur toi"
            onClick={handleExporterMesDonnees}
          />
        </Liste>
        {erreurExport && <p className="text-sm text-[var(--dj-erreur)]">{erreurExport}</p>}

        <Liste>
          <LigneListe
            icone={Trash2}
            titre={suppressionEnCours ? "Suppression…" : "Supprimer mon compte"}
            onClick={confirmerSuppressionCompte}
            danger
          />
        </Liste>
        {erreurSuppression && <p className="text-sm text-[var(--dj-erreur)]">{erreurSuppression}</p>}
      </div>
    );
  }

  // --- Capacités du téléphone ------------------------------------------------
  if (vue === "capacites-telephone") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Capacités du téléphone" onRetour={() => setVue("liste")} />
        <ConnecteurNotionCarte />
        <MiseAJourCarte />
      </div>
    );
  }

  // --- Accessibilité -----------------------------------------------------
  if (vue === "accessibilite") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Accessibilité" onRetour={() => setVue("liste")} />
        <EspaceAccessibilite />
      </div>
    );
  }

  // --- Profil ------------------------------------------------------------
  if (vue === "profil") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Profil" onRetour={() => setVue("liste")} />

        <div className="flex flex-col gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputFichierRef.current?.click()}
              disabled={uploadEnCours}
              aria-label="Changer la photo de profil"
              className="group relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border border-dj-bordure bg-dj-surface-haute disabled:opacity-60"
            >
              {profil?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar_url vient de Supabase Storage
                <img src={profil.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-bold text-dj-texte-muet">
                  {libelleProfil.trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                <Camera size={18} className={uploadEnCours ? "animate-pulse" : ""} />
              </span>
            </button>
            <input
              ref={inputFichierRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const fichier = e.target.files?.[0];
                if (fichier) changerAvatar(fichier);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputFichierRef.current?.click()}
              disabled={uploadEnCours}
              className="text-sm font-medium text-dj-texte-muet hover:text-dj-texte hover:underline disabled:opacity-50"
            >
              {uploadEnCours ? "Envoi…" : "Changer la photo"}
            </button>
          </div>
          {erreurAvatar && <p className="text-sm text-[var(--dj-erreur)]">{erreurAvatar}</p>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nom-affiche" className="text-sm font-medium text-dj-texte">
              Nom affiché
            </label>
            <input
              id="nom-affiche"
              type="text"
              value={nomAffiche}
              onChange={(e) => setNomAffiche(e.target.value)}
              placeholder="Ton nom"
              className="w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="text-sm font-medium text-dj-texte">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Quelques mots sur toi (optionnel)."
              className="w-full resize-y rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-sm text-dj-texte outline-none focus:border-dj-bordure-forte"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={enregistrerProfil}
              disabled={enregistrementProfil}
              className="rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {enregistrementProfil ? "Enregistrement…" : "Enregistrer"}
            </button>
            {messageProfil && <span className="text-sm text-dj-texte-muet">{messageProfil}</span>}
          </div>
          {erreurProfil && <p className="text-sm text-[var(--dj-erreur)]">{erreurProfil}</p>}
        </div>
      </div>
    );
  }

  // --- Préférences ---------------------------------------------------------
  if (vue === "preferences") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Préférences" onRetour={() => setVue("liste")} />

        <div className="flex flex-col gap-4 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-dj-texte">Thème</span>
            <div className="flex gap-2">
              {ORDRE_THEME.map((t) => {
                const Icone = ICONES_THEME[t];
                const actif = choixTheme === t;
                return (
                  <button
                    key={t}
                    onClick={() => changerTheme(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      actif
                        ? "border-dj-bordure-forte bg-dj-surface-haute text-dj-texte"
                        : "border-dj-bordure text-dj-texte-muet hover:bg-dj-surface-haute"
                    }`}
                  >
                    <Icone size={16} />
                    {LIBELLES_THEME[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-dj-bordure pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-dj-texte">Relances de Clovis</span>
              <span className="text-xs text-dj-texte-muet">
                Autorise Clovis à te relancer si tu es inactif, pour ne pas perdre le fil.
              </span>
            </div>
            <button
              role="switch"
              aria-checked={notifsActives}
              onClick={basculerNotifs}
              disabled={enregistrementNotifs}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                notifsActives ? "bg-dj-accent-1" : "bg-dj-inactif"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  notifsActives ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {messageNotifs && <span className="text-sm text-dj-texte-muet">{messageNotifs}</span>}
        </div>
      </div>
    );
  }

  // --- Confidentialité et sécurité -----------------------------------------
  if (vue === "confidentialite") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Confidentialité et sécurité" onRetour={() => setVue("liste")} />

        <form
          onSubmit={changerMotDePasse}
          className="flex flex-col gap-3 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4"
        >
          <p className="text-sm text-dj-texte-muet">Change le mot de passe de ton compte.</p>
          <ChampMotDePasse
            id="nouveau-mdp"
            label="Nouveau mot de passe"
            value={motDePasse}
            onChange={setMotDePasse}
            autoComplete="new-password"
          />
          <ChampMotDePasse
            id="confirmation-mdp"
            label="Confirme le mot de passe"
            value={confirmationMotDePasse}
            onChange={setConfirmationMotDePasse}
            autoComplete="new-password"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={enregistrementMotDePasse || !motDePasse}
              className="self-start rounded-cgpt-bouton bg-dj-accent-1 px-5 py-2 text-sm font-bold text-[#1A0D02] transition-colors hover:bg-dj-accent-2 disabled:opacity-50"
            >
              {enregistrementMotDePasse ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
            {messageMotDePasse && <span className="text-sm text-dj-texte-muet">{messageMotDePasse}</span>}
          </div>
          {erreurMotDePasse && <p className="text-sm text-[var(--dj-erreur)]">{erreurMotDePasse}</p>}
        </form>
      </div>
    );
  }

  // --- Aide et support -----------------------------------------------------
  if (vue === "aide") {
    return (
      <div className="flex flex-col gap-4">
        <EnTete titre="Aide et support" onRetour={() => setVue("liste")} />
        <div className="rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-lg border border-dj-bordure px-4 py-2 text-sm text-dj-texte transition-colors hover:bg-dj-surface-haute"
          >
            <MessageCircle size={16} />
            Poser une question à Clovis
          </button>
        </div>
        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-dj-texte-muet">
            À propos des sections
          </h3>
          <div className="divide-y divide-dj-bordure rounded-cgpt-carte border border-dj-bordure bg-dj-surface">
            {RUBRIQUES_AIDE.map((rubrique) => (
              <RubriqueAideDepliable
                key={rubrique.id}
                rubrique={rubrique}
                ouverte={rubriqueAideOuverte === rubrique.id}
                onToggle={() =>
                  setRubriqueAideOuverte((actuelle) => (actuelle === rubrique.id ? null : rubrique.id))
                }
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- À propos --------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      <EnTete titre="À propos" onRetour={() => setVue("liste")} />
      <div className="flex flex-col gap-2 rounded-cgpt-carte border border-dj-bordure bg-dj-surface p-4 text-sm">
        <span className="text-dj-texte">Clovis</span>
        <button
          onClick={() => router.push("/cgu")}
          className="w-fit text-dj-texte-muet hover:text-dj-texte hover:underline"
        >
          Conditions générales d&apos;utilisation
        </button>
        <button
          onClick={() => router.push("/copyright")}
          className="w-fit text-dj-texte-muet hover:text-dj-texte hover:underline"
        >
          Droit d&apos;auteur
        </button>
        <button
          onClick={() => router.push("/confidentialite")}
          className="w-fit text-dj-texte-muet hover:text-dj-texte hover:underline"
        >
          Politique de confidentialité
        </button>
      </div>
    </div>
  );
}
