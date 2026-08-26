import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { TEMATA } from './lib/temata';

/**
 * Schéma dat. Tohle je pojistka, ne byrokracie: když někdo v souboru
 * kandidáta napíše téma s překlepem nebo zapomene pořadí, shodí to
 * sestavení webu — chyba se ukáže mně, ne návštěvníkovi.
 *
 * Soubory začínající podtržítkem (`_SABLONA.md`) se přeskakují,
 * takže vzor pro vyplňování může ležet rovnou vedle skutečných dat.
 *
 * Nevyplněná pole jsou `nullish`, ne `optional` — a je to schválně.
 * `foto:` bez hodnoty je v YAML `null`, ne chybějící klíč, a `optional()`
 * by null odmítl. Kdyby tu bylo `optional()`, každý nevyplněný řádek
 * v šabloně by shodil sestavení.
 */

const kandidati = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!_*.md'], base: './src/content/kandidati' }),
  schema: ({ image }) =>
    z.object({
      poradi: z.number().int().min(1),
      jmeno: z.string(),
      vek: z.number().int().optional(),
      povolani: z.string(),
      prislusnost: z.string().optional(),
      /** 1–3 oblasti, kterým se člověk chce věnovat. Musí být ze seznamu v temata.ts. */
      temata: z.array(z.enum(TEMATA)).max(3).default([]),
      /** Prázdné = použije se zástupná silueta. */
      foto: image().nullish(),
      /** Jedna věta, která se na medailonku vytáhne velkým písmem. */
      citace: z.string().nullish(),
      /** Zapojení mimo práci — spolky, sdružení. */
      pusobeni: z.string().nullish(),
    }),
});

const program = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!_*.md'], base: './src/content/program' }),
  schema: z.object({
    poradi: z.number().int(),
    /** Krátký název na dlaždici na úvodní stránce — musí se vejít na řádek. */
    nazev: z.string(),
    /** Plný nadpis oblasti tak, jak je na stránce programu. */
    nadpis: z.string().nullish(),
    /** Jedna věta na dlaždici na úvodní stránce. */
    shrnuti: z.string(),
    tema: z.enum(TEMATA),
  }),
});

const zamery = defineCollection({
  loader: glob({ pattern: ['**/*.md', '!_*.md'], base: './src/content/zamery' }),
  schema: z.object({
    poradi: z.number().int(),
    nazev: z.string(),
    tema: z.enum(TEMATA),
    /**
     * Zeměpisné souřadnice místa. Web si z nich polohu na mapě dopočítá sám
     * (src/lib/mapa.ts), takže když se změní výřez mapy, body se posunou
     * s ním. Zjistí se nejsnáz na mapy.cz — pravý klik na místo.
     */
    lat: z.number().min(48).max(51),
    lon: z.number().min(12).max(19),
    /**
     * `navrh` = bod, u kterého text zatím nikdo z týmu nepotvrdil.
     * Vykreslí se s viditelnou značkou, aby si ho nikdo nespletl se závazkem.
     * Jakmile text potvrdíte, přepište na `overeno` a značka zmizí.
     */
    stav: z.enum(['navrh', 'overeno']).default('navrh'),
  }),
});

export const collections = { kandidati, program, zamery };
