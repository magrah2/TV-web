/**
 * Fotky kandidátů nejsou v datech (frontmatteru), ale ve složkách podle jejich
 * id — to je vždycky stejný název, jaký má soubor v src/content/kandidati/,
 * jen bez přípony (např. 20-vojtech-liska.md → id 20-vojtech-liska).
 * Stačí tak fotku hodit do složky src/assets/portrety/<id>/, nic se
 * nemusí vypisovat ručně a nic to nerozbije, když složka nebo soubor chybí.
 *
 * Použije se ta s nejnižším číslem v názvu (01.jpg, 02.jpg, …) — další
 * fotky ve složce se zatím nevyužívají.
 */

const soubory = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/portrety/*/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

interface Zaznam {
  cislo: number;
  obrazek: ImageMetadata;
}

const podleId = new Map<string, Zaznam[]>();

for (const [cesta, modul] of Object.entries(soubory)) {
  const shoda = cesta.match(/\/portrety\/([^/]+)\/(\d+)\.[^./]+$/);
  if (!shoda) continue;
  const [, id, cisloText] = shoda;
  const seznam = podleId.get(id) ?? [];
  seznam.push({ cislo: Number(cisloText), obrazek: modul.default });
  podleId.set(id, seznam);
}

export function fotkaKandidata(id: string): ImageMetadata | undefined {
  const seznam = podleId.get(id);
  if (!seznam?.length) return undefined;
  return seznam.reduce((nejnizsi, aktualni) => (aktualni.cislo < nejnizsi.cislo ? aktualni : nejnizsi)).obrazek;
}
