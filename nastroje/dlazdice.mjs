/**
 * Stahne vektorove dlazdice a pisma pro mapy:  node nastroje/dlazdice.mjs
 *
 * Mapy na webu bezi na MapLibre, ktery si podklad sklada z vektorovych
 * dlazdic. Verejna sluzba OpenFreeMap je nabizi zdarma, jenze pak by kazdy
 * navstevnik posilal svoji IP adresu na cizi server. Proto si je jednou
 * stahneme k sobe a commitneme je - stejne jako driv SVG podklad. Hotovy web
 * pak nesaha nikam ven a zustava v platnosti, ze nepotrebuje cookie listu.
 *
 * OpenFreeMap s tim primo pocita: licence je MIT, self-hosting doporucuji
 * sami a nabizeji i stazeni cele planety. Podminka je uvedeni zdroje,
 * ktere mapa vykresluje v rohu.
 *
 * Proc je toho tak malo (88 souboru, 1,7 MB): dlazdice konci na zoomu 14.
 * Vys uz zadne neexistuji ani u OpenFreeMap - blizsi pohled si MapLibre
 * dopocita z tech ctrnactkovych. Stahuje se tedy jen zoom 11 az 14; nize
 * by mapa stejne ukazovala pul Moravy, coz nechceme.
 *
 * Data (c) prispevatele OpenStreetMap (ODbL), dlazdice (c) OpenMapTiles.
 */

import fs from 'node:fs';
import path from 'node:path';
import { VYREZ_OBCE as VYREZ } from './vyrez-obce.mjs';

const SLUZBA = 'https://tiles.openfreemap.org';

/**
 * Rezerva kolem vyrezu ve stupnich - u oddalenych zoomu vetsi.
 *
 * Neco kolem vyrezu byt musi vzdycky: MapLibre si rika o kazdou dlazdici,
 * ktera do okna zasahuje byt rohem, takze potrebuje i tu hned za hranici.
 *
 * Velka rezerva u oddalenych zoomu resi jinou vec. Obec je skoro ctvercova,
 * ale ram mapy na sirokem displeji ctvercovy neni. Aby se cela obec vesla
 * na vysku, musi mapa do sirky ukazat skoro dvakrat tolik - a to uz je kus
 * okolnich poli. Bez nich by po stranach zely prazdne pruhy.
 *
 * U nejblizsiho zoomu se to naopak nevyplati: dlazdic je tam nejvic a nikdo
 * si priblizeny pohled na pole mezi Drnovicemi neotevre. Kdyby se tam presto
 * nekdo dostal, MapLibre mu vykresli data z nizsiho zoomu.
 */
const REZERVA = 0.012;
const REZERVA_SIROKA = 0.06;
const ZOOM_SIROKE_REZERVY = 13;

/** Nejmensi a nejvetsi stahovany zoom. Mapa nesmi jit oddalit pod ZOOM_OD. */
const ZOOM_OD = 11;
const ZOOM_DO = 14;

/**
 * Rezy pisma pro popisky a rozsahy znaku.
 *
 * Dva rozsahy staci: `0-255` je zakladni latinka, `256-511` obsahuje cestinu
 * (hacky a carky lezi v Latin Extended-A). Dalsi rozsahy by se stahovaly
 * zbytecne - na mape Vyskova neni co by je potrebovalo.
 *
 * Rezy musi sedet s tim, co pouziva `src/lib/styl-mapy.ts`. Kdyz se tam
 * nejaky pribere, musi pribyt i sem, jinak popisky zmizi.
 */
const PISMA = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];
const ROZSAHY = ['0-255', '256-511'];

const KAM_DLAZDICE = 'public/dlazdice';
/** Pruvodka pro web: co je stazene. Cte to `src/lib/styl-mapy.ts`. */
const CIL_POPISU = 'src/lib/mapa-dlazdice.json';
/** Papirek s puvodem dat. Lezi mezi dlazdicemi, takze ho `vycisti` musi znat. */
const PRUVODKA = 'PUVOD.txt';
const KAM_PISMA = 'public/pisma-mapy';

// --- Prepocet zemepisnych souradnic na cisla dlazdic -----------------------

const dlazdiceX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const dlazdiceY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

// --- Pomocnici -------------------------------------------------------------

/**
 * Smaze drive stazenou slozku.
 *
 * Kdyby se jen prepisovalo, po zmenseni vyrezu by v repozitari zustaly
 * dlazdice, ktere uz nikdo nepouziva, a nikdo by si jich nevsiml. Maze se
 * jen to, co skript sam vyrobil - proto ta kontrola pripon.
 */
function vycisti(slozka, pripona) {
  if (!fs.existsSync(slozka)) return;
  const cizi = [];
  const projdi = (kde) => {
    for (const polozka of fs.readdirSync(kde, { withFileTypes: true })) {
      const cesta = path.join(kde, polozka.name);
      if (polozka.isDirectory()) projdi(cesta);
      else if (polozka.name !== PRUVODKA && !polozka.name.endsWith(pripona)) cizi.push(cesta);
    }
  };
  projdi(slozka);
  if (cizi.length) {
    throw new Error(
      'Ve slozce ' + slozka + ' lezi soubor, ktery tam tenhle skript nedal: ' +
        cizi[0] + '. Radsi nic nemazu - podivejte se na to.',
    );
  }
  fs.rmSync(slozka, { recursive: true });
}

async function stahni(adresa) {
  for (let pokus = 1; ; pokus++) {
    const odpoved = await fetch(adresa, {
      headers: { 'User-Agent': 'transparentnivyskov.cz generator map (jednorazove)' },
    });
    if (odpoved.ok) return Buffer.from(await odpoved.arrayBuffer());
    if (odpoved.status === 404) return null;

    if (pokus === 4) throw new Error(adresa + ' odpovedel ' + odpoved.status);
    const cekat = pokus * 10;
    console.log('   server ma napilno (' + odpoved.status + '), zkusim za ' + cekat + ' s');
    await new Promise((hotovo) => setTimeout(hotovo, cekat * 1000));
  }
}

const vKilobajtech = (bajtu) => Math.round(bajtu / 1024) + ' kB';

/** Ctyri desetinna mista jsou asi deset metru - na hranici mapy az dost. */
const zaokrouhli = (stupne) => Math.round(stupne * 1e4) / 1e4;

// --- Dlazdice --------------------------------------------------------------

async function stahniDlazdice() {
  console.log('>> Dlazdice');

  // Adresa dlazdic obsahuje datum, kdy byla mapa vyrobena, a s kazdym tydnem
  // se meni. Proto se nepise natvrdo, ale precte se z popisu sluzby.
  const popis = await (await fetch(SLUZBA + '/planet')).json();
  const sablona = popis.tiles[0];
  console.log('   zdroj: ' + sablona);

  if (popis.maxzoom < ZOOM_DO) {
    throw new Error('Sluzba nabizi jen zoom do ' + popis.maxzoom + ', skript chce ' + ZOOM_DO);
  }

  vycisti(KAM_DLAZDICE, '.pbf');

  const obal = (rezerva) => ({
    jih: VYREZ.jih - rezerva,
    sever: VYREZ.sever + rezerva,
    zapad: VYREZ.zapad - rezerva,
    vychod: VYREZ.vychod + rezerva,
  });

  let souboru = 0;
  let bajtu = 0;

  for (let z = ZOOM_OD; z <= ZOOM_DO; z++) {
    const o = obal(z <= ZOOM_SIROKE_REZERVY ? REZERVA_SIROKA : REZERVA);
    const odX = dlazdiceX(o.zapad, z);
    const doX = dlazdiceX(o.vychod, z);
    const odY = dlazdiceY(o.sever, z);
    const doY = dlazdiceY(o.jih, z);
    let vZoomu = 0;

    for (let x = odX; x <= doX; x++) {
      for (let y = odY; y <= doY; y++) {
        const data = await stahni(
          sablona.replace('{z}', z).replace('{x}', x).replace('{y}', y),
        );
        // Prazdna dlazdice (404) je legitimni: tam, kde nic neni, sluzba
        // zadna data nema. MapLibre si s chybejici dlazdici poradi.
        if (!data) continue;

        const slozka = path.join(KAM_DLAZDICE, String(z), String(x));
        fs.mkdirSync(slozka, { recursive: true });
        fs.writeFileSync(path.join(slozka, y + '.pbf'), data);
        souboru++;
        vZoomu++;
        bajtu += data.length;
      }
    }
    console.log('   zoom ' + z + ': ' + vZoomu + ' dlazdic');
  }

  console.log('   celkem ' + souboru + ' souboru, ' + vKilobajtech(bajtu));
  return popis;
}

// --- Pisma popisku ---------------------------------------------------------

async function stahniPisma() {
  console.log('\n>> Pisma popisku');
  vycisti(KAM_PISMA, '.pbf');

  let bajtu = 0;
  for (const pismo of PISMA) {
    fs.mkdirSync(path.join(KAM_PISMA, pismo), { recursive: true });
    for (const rozsah of ROZSAHY) {
      const data = await stahni(
        SLUZBA + '/fonts/' + encodeURIComponent(pismo) + '/' + rozsah + '.pbf',
      );
      if (!data) throw new Error('Pismo ' + pismo + ' ' + rozsah + ' sluzba nezna');
      fs.writeFileSync(path.join(KAM_PISMA, pismo, rozsah + '.pbf'), data);
      bajtu += data.length;
    }
    console.log('   ' + pismo);
  }
  console.log('   celkem ' + PISMA.length * ROZSAHY.length + ' souboru, ' + vKilobajtech(bajtu));
}

// --- Zapis pruvodky --------------------------------------------------------

/**
 * Vedle dlazdic zustane papirek s tim, odkud a kdy jsou.
 *
 * Dlazdice jsou zamrzly snimek sveta. Az nekdo za rok zjisti, ze na mape
 * chybi nova ulice, ma se z ceho dozvedet, jak stara data to jsou a cim je
 * obnovit.
 */
function zapisPruvodku(popis) {
  const text = `Vektorove dlazdice a pisma pro mapy na webu
===========================================

Needitovat rucne. Vyrabi to skript:

    node nastroje/dlazdice.mjs

Zdroj:  ${popis.tiles[0]}
Zoom:   ${ZOOM_OD} az ${ZOOM_DO}
Vyrez:  ${VYREZ.jih} - ${VYREZ.sever} sirky, ${VYREZ.zapad} - ${VYREZ.vychod} delky
Kdy:    ${new Date().toISOString().slice(0, 10)}

Je to zamrzly snimek. Kdyz na mape chybi neco noveho, spustte skript znovu.

Data (c) prispevatele OpenStreetMap, licence ODbL.
Dlazdice (c) OpenMapTiles, sluzba OpenFreeMap (MIT).
Uvedeni zdroje v rohu mapy je podminka licence - nesmi zmizet.
`;
  fs.writeFileSync(path.join(KAM_DLAZDICE, PRUVODKA), text);
}

// --- Hlavni beh ------------------------------------------------------------

const popis = await stahniDlazdice();
await stahniPisma();
zapisPruvodku(popis);

// Web potrebuje vedet, kam az dlazdice sahaji a v jakem rozsahu zoomu.
// Kdyby si to opisoval rucne, po zmene vyrezu by se to tise rozeslo a mapa
// by na okraji zbelela.
fs.writeFileSync(
  CIL_POPISU,
  JSON.stringify(
    {
      jih: zaokrouhli(VYREZ.jih - REZERVA_SIROKA),
      sever: zaokrouhli(VYREZ.sever + REZERVA_SIROKA),
      zapad: zaokrouhli(VYREZ.zapad - REZERVA_SIROKA),
      vychod: zaokrouhli(VYREZ.vychod + REZERVA_SIROKA),
      nejmensiZoom: ZOOM_OD,
      nejvetsiZoom: ZOOM_DO,
    },
    null,
    2,
  ) + '\n',
);
console.log('   ' + CIL_POPISU);
console.log('\nHotovo. Nezapomente vysledek commitnout.');
