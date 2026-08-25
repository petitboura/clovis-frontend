// 25/08/2026, demande Bourama : "je veux que les skills soient
// téléchargeables en fichier MD" -- pas d'appel réseau ici (le contenu
// est déjà en mémoire côté client, contrairement à un fichier de la
// bibliothèque qui vit dans Supabase Storage), juste un Blob local.
// Générique (nomFichier + contenu + type MIME) pour rester réutilisable
// au-delà des skills si un autre export texte est demandé plus tard.
export function telechargerTexte(nomFichier: string, contenu: string, typeMime = "text/markdown;charset=utf-8") {
  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
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
