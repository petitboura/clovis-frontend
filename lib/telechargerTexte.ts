import { telechargerContenuLocal } from "@/lib/telecharger";

// 25/08/2026, demande Bourama : "je veux que les skills soient
// téléchargeables en fichier MD" -- pas d'appel réseau ici (le contenu
// est déjà en mémoire côté client, contrairement à un fichier de la
// bibliothèque qui vit dans Supabase Storage), juste un Blob local.
// Générique (nomFichier + contenu + type MIME) pour rester réutilisable
// au-delà des skills si un autre export texte est demandé plus tard.
//
// 12/09/2026, Bourama : délègue maintenant à lib/telecharger.ts pour un
// vrai téléchargement système sur Android (MediaStore.Downloads +
// notification, au lieu du <a download> web qui ne fait rien dans
// l'appli) -- replis web/iOS inchangés.
export function telechargerTexte(nomFichier: string, contenu: string, typeMime = "text/markdown;charset=utf-8") {
  telechargerContenuLocal(nomFichier, contenu, typeMime);
}

// Nom de fichier sûr à partir du nom d'affichage d'un skill (espaces ->
// tirets, caractères spéciaux retirés) -- évite un nom de fichier
// téléchargé illisible ou invalide selon l'OS.
export function nomFichierDepuis(nom: string, extension: string) {
  const nettoye = nom
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${nettoye || "skill"}.${extension}`;
}
