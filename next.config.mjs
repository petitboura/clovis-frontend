/** @type {import('next').NextConfig} */
const nextConfig = {
  // Branche capacitor-export uniquement (clovis-mobile, Lot 3A) : main/Vercel
  // reste en rendu dynamique normal. L'export statique produit `out/`, que
  // Capacitor embarque dans l'app pour le mode hors-ligne de la coquille
  // (le chat reste connecte au backend/Supabase quoi qu'il arrive).
  output: "export",
  images: {
    // next/image non utilise dans ce depot (verifie), mais unoptimized:true
    // par securite : l'export statique ne peut pas servir l'API
    // d'optimisation d'image de toute facon.
    unoptimized: true,
    // image_vitrine_url (agents.image_vitrine_url, voir PIVOT_SOCIAL.md)
    // est hébergée sur Supabase Storage — next/image refuse par défaut
    // tout domaine non déclaré. Wildcard sur *.supabase.co plutôt que le
    // project ref exact : évite de casser l'image si le projet change
    // (dev/prod) ou si le bucket est reconfiguré.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
