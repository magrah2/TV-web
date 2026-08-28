/**
 * Fotky kandidátů nejsou v datech (frontmatteru), ale rovnou v souborech
 * podle jejich id — to je vždycky stejný název, jaký má soubor v
 * src/content/kandidati/, jen bez přípony (např. 20-vojtech-liska.md
 * → id 20-vojtech-liska, fotka src/assets/portrety/20-vojtech-liska.jpg).
 * Stačí tak fotku pod tímhle jménem přidat do složky, nic se nemusí
 * vypisovat ručně a nic to nerozbije, když soubor chybí.
 */

const soubory = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/portrety/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const podleId = new Map<string, ImageMetadata>();

for (const [cesta, modul] of Object.entries(soubory)) {
  const shoda = cesta.match(/\/portrety\/([^/]+)\.[^./]+$/);
  if (!shoda) continue;
  podleId.set(shoda[1], modul.default);
}

export function fotkaKandidata(id: string): ImageMetadata | undefined {
  return podleId.get(id);
}
