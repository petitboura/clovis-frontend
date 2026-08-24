"use client";

export function ChampTelephone({
  id,
  value,
  onChange,
  label = "Numéro de téléphone",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-dj-texte-muet">
        {label}
      </label>
      <input
        id={id}
        type="tel"
        required
        placeholder="+223 70 00 00 00"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-dj-bordure bg-dj-surface-haute px-3 py-2 text-dj-texte outline-none focus:border-dj-bordure-forte"
      />
    </div>
  );
}
