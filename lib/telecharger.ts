"use client";

// Créé le 12/09/2026, demande Bourama : "les boutons téléchargement
// partout où ils sont doivent déclencher un vrai téléchargement... comme
// si tu télécharges une musique ou une vidéo". Point d'entrée unique pour
// tout téléchargement dans Clovis (bibliothèque, PDF, fichiers/images/
// médias du chat, exports de skills, graphiques générés) -- remplace les
// implémentations dupliquées qui existaient jusque-là dans
// EspaceBibliotheque.tsx/BibliothequePublique.tsx/VisionneurPdf.tsx
// (VisionneuseBibliotheque.tsx::telecharger), components/chat/FichierChip.tsx,
// components/chat/ImageMessage.tsx, components/chat/LecteurMedia.tsx,
// components/chat/BlocCode.tsx, lib/telechargerTexte.ts et
// lib/telechargerImageGraphique.ts.
//
// Deux chemins distincts, selon si le contenu a déjà une URL ou pas :
//
// - telecharger(url, nom) : le contenu existe déjà à une URL (Supabase
//   Storage, ou toute autre source réseau -- bibliothèque, PDF, fichiers/
//   images/médias du chat). Sur Android natif, délègue au plugin natif
//   Telechargement (DownloadManager système : notification de
//   progression, son à la fin, fichier rangé dans Téléchargements --
//   exactement comme un téléchargement de musique ou de vidéo). Sur iOS
//   natif, pas d'équivalent système avec notification : repli sur le
//   partage natif (comportement inchangé). Sur web, comportement inchangé
//   (fetch+blob, ou nouvel onglet si le fetch échoue).
//
// - telechargerContenuLocal(nom, contenu, typeMime) : le contenu n'existe
//   QUE côté client (texte déjà en mémoire -- export de skill, code d'un
//   bloc du chat -- ou blob généré -- PNG d'un graphique/schéma) : pas
//   d'URL à donner à DownloadManager. Sur Android natif, écrit
//   directement dans la collection MediaStore.Downloads (plugin natif)
//   puis affiche une notification de fin, pour le même résultat perçu
//   (fichier dans Téléchargements + notification) sans dépendre d'une
//   URL. iOS et web : comportement inchangé (partage natif / <a download>).
//
// Ne touche à rien côté Supabase : uniquement la façon dont le fichier
// (déjà obtenu par ailleurs) atterrit sur l'appareil.

async function plateforme(): Promise<"android" | "ios" | "web"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return "web";
    return Capacitor.getPlatform() === "android" ? "android" : "ios";
  } catch {
    return "web";
  }
}

type PluginTelechargement = {
  depuisUrl(options: { url: string; nom: string }): Promise<{ id: string }>;
  depuisContenuLocal(options: { base64: string; nom: string; typeMime: string }): Promise<{ succes: boolean }>;
};

async function pluginTelechargement(): Promise<PluginTelechargement> {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<PluginTelechargement>("Telechargement");
}

function blobVersBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onloadend = () => resolve((lecteur.result as string).split(",")[1] ?? "");
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

// Repli commun (iOS natif, ou Android si le DownloadManager/MediaStore
// natif échoue pour une raison quelconque) : écrit le contenu dans le
// cache de l'appli puis ouvre le menu de partage système, qui permet
// d'enregistrer ou d'envoyer le fichier -- comportement natif d'origine,
// inchangé.
async function telechargerViaPartageNatif(blob: Blob, nom: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const base64 = await blobVersBase64(blob);
  const { uri } = await Filesystem.writeFile({ path: nom, data: base64, directory: Directory.Cache });
  await Share.share({ files: [uri], dialogTitle: nom });
}

function telechargerViaBlobWeb(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/** Téléchargement d'un contenu déjà accessible par URL (voir en-tête de fichier). */
export async function telecharger(href: string, nom: string) {
  const plateformeActuelle = await plateforme();

  if (plateformeActuelle === "android") {
    try {
      const plugin = await pluginTelechargement();
      await plugin.depuisUrl({ url: href, nom });
      return;
    } catch {
      // Repli plus bas (partage natif, puis web) si le DownloadManager
      // système échoue pour une raison quelconque (URL non http,
      // permission refusée...).
    }
  }

  if (plateformeActuelle !== "web") {
    try {
      const reponse = await fetch(href);
      await telechargerViaPartageNatif(await reponse.blob(), nom);
      return;
    } catch {
      // Repli sur le comportement web ci-dessous.
    }
  }

  try {
    const reponse = await fetch(href);
    telechargerViaBlobWeb(await reponse.blob(), nom);
  } catch {
    window.open(href, "_blank");
  }
}

/** Téléchargement d'un contenu qui n'existe QUE côté client (texte, blob généré). */
export async function telechargerContenuLocal(
  nom: string,
  contenu: string | Blob,
  typeMime = "application/octet-stream"
) {
  const blob = typeof contenu === "string" ? new Blob([contenu], { type: typeMime }) : contenu;
  const plateformeActuelle = await plateforme();

  if (plateformeActuelle === "android") {
    try {
      const base64 = await blobVersBase64(blob);
      const plugin = await pluginTelechargement();
      await plugin.depuisContenuLocal({ base64, nom, typeMime: blob.type || typeMime });
      return;
    } catch {
      // Repli plus bas (partage natif, puis web) -- notamment sur un
      // appareil Android < 10, où MediaStore.Downloads n'existe pas.
    }
  }

  if (plateformeActuelle !== "web") {
    try {
      await telechargerViaPartageNatif(blob, nom);
      return;
    } catch {
      // Repli sur le comportement web ci-dessous.
    }
  }

  telechargerViaBlobWeb(blob, nom);
}
