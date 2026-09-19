import maplibre from 'maplibre-gl';
import { STYL_MAPY, DLAZDICE_POKRYVAJI } from './styl-mapy';

/**
 * Společný podklad všech map na webu.
 *
 * Mapy jsou tři a každá dělá něco jiného — záměry, volební okrsky, sběr
 * podnětů na stánku. Podklad pod nimi je ale jeden a týž: stejné dlaždice,
 * stejný styl, stejné chování. Dřív měla každá mapa svoje vlastní obarvení
 * a rozjížděly se: na jedné byla řeka zelená, na druhé modrá.
 *
 * Tenhle modul tedy vyrobí hotovou mapu a jednotlivé stránky si na ni jen
 * přidají svoje — odznaky záměrů, plochy okrsků, body podnětů.
 *
 * Dlaždice i písma popisků leží v repozitáři, nic se netahá z cizích serverů.
 * Podrobnosti jsou ve `styl-mapy.ts` a v `nastroje/dlazdice.mjs`.
 */

/**
 * Kam až se dá s mapou odjet — přesně tam, kam sahají stažené dlaždice.
 *
 * Je to o kus víc než katastr obce, a je to tak schválně. Obec je skoro
 * čtvercová, ale rám mapy na širokém displeji ne; aby se celá vešla na výšku,
 * musí mapa do šířky ukázat i kus okolních polí. Kdyby hranice končila na
 * katastru, mapa by se na takový pohled vůbec nedala nastavit a zůstala by
 * přiblížená na střed.
 *
 * Zapisuje se jako [[západ, jih], [východ, sever]] — tak to chce MapLibre.
 */
export const HRANICE_DLAZDIC: [[number, number], [number, number]] = [
  [DLAZDICE_POKRYVAJI.zapad, DLAZDICE_POKRYVAJI.jih],
  [DLAZDICE_POKRYVAJI.vychod, DLAZDICE_POKRYVAJI.sever],
];

/**
 * Hlášky knihovny česky.
 *
 * MapLibre má texty anglicky a promítá je do `aria-label` ovládacích prvků
 * i do nápovědy k opatrnému ovládání. Anglická věta uprostřed českého webu
 * je vidět a čtečka obrazovky ji přečte taky.
 */
const HLASKY: Record<string, string> = {
  'AttributionControl.ToggleAttribution': 'Zobrazit zdroje dat',
  'AttributionControl.MapFeedback': 'Připomínka k mapě',
  'NavigationControl.ZoomIn': 'Přiblížit',
  'NavigationControl.ZoomOut': 'Oddálit',
  'NavigationControl.ResetBearing': 'Otočit na sever',
  'CooperativeGesturesHandler.WindowsHelpText': 'Přiblížit jde Ctrl a kolečkem',
  'CooperativeGesturesHandler.MacHelpText': 'Přiblížit jde ⌘ a kolečkem',
  'CooperativeGesturesHandler.MobileHelpText': 'Mapu posunete dvěma prsty',
};

export type VolbyMapy = {
  /** Prvek, do kterého se mapa vykreslí. */
  prvek: HTMLElement;
  /** Kam se mapa dívá při otevření: [délka, šířka]. */
  stred: [number, number];
  zoom: number;
  /**
   * Na dotyku je potřeba druhý prst.
   *
   * Patří na stránky, kde mapa leží uprostřed textu: bez toho člověk na
   * telefonu palcem projíždí stránku, trefí mapu a místo posunu stránky se
   * mu přiblíží Vyškov. Tak to dělají i běžné mapy.
   *
   * **Na počítači to neplatí** — tam kolečko přibližuje rovnou, bez držení
   * Ctrl. Knihovna umí jen obojí najednou, takže se rozhoduje podle toho,
   * čím se na stránku sahá.
   *
   * Na stánku se nehodí ani jedno: tam je mapa to hlavní a obsluha do ní
   * ťuká a posouvá ji jedním prstem.
   */
  opatrneOvladani?: boolean;
};

/**
 * Vyrobí mapu se společným podkladem.
 *
 * Co je tu nastavené pro všechny stejně:
 *
 * - **Za hranice obce se nedá odjet.** Dlaždice jinde nemáme a prázdná mapa
 *   vypadá jako rozbitá stránka.
 * - **Oddálit pod zoom dlaždic taky ne.** Tam už data končí a mapa by zmizela.
 * - **Mapa se nenaklání ani neotáčí.** Otočená mapa města nikomu nepomůže
 *   a na dotyku se do ní snadno šťouchne omylem.
 */
export function vytvorMapu({ prvek, stred, zoom, opatrneOvladani = false }: VolbyMapy) {
  const mapa = new maplibre.Map({
    container: prvek,
    style: STYL_MAPY as never,
    center: stred,
    zoom,
    maxBounds: HRANICE_DLAZDIC,
    minZoom: DLAZDICE_POKRYVAJI.nejmensiZoom,
    // Nad zoomem dlaždic se dál přibližovat dá — MapLibre si bližší pohled
    // dopočítá z těch, které má. Popisky zůstanou ostré, čáry se roztáhnou.
    maxZoom: 18,
    pitchWithRotate: false,
    dragRotate: false,
    // Jen na dotykovém displeji. `(pointer: coarse)` znamená, že hlavní
    // ukazovátko je prst, ne myš.
    cooperativeGestures:
      opatrneOvladani &&
      typeof matchMedia !== 'undefined' &&
      matchMedia('(pointer: coarse)').matches,
    // Zdroje patří do LEVÉHO dolního rohu. Vpravo dole mají všechny mapy
    // tlačítka přiblížení a knihovna by je uvedením zdrojů překryla.
    attributionControl: false,
    locale: HLASKY,
  });
  mapa.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');

  // Na širokém displeji ať jsou zdroje vypsané — je to slušnost vůči lidem,
  // kteří ta data dělají, a u webu s tímhle názvem to sedí. Na telefonu se
  // ale přes mapu roztáhnou na dva řádky a překryjí ji, takže se sbalí pod
  // ikonku. Knihovna je při zapnutém `compact` nechává otevřené.
  mapa.once('load', () => {
    if (prvek.clientWidth > 640) return;
    const zdroje = prvek.querySelector('details.maplibregl-ctrl-attrib');
    zdroje?.removeAttribute('open');
    zdroje?.classList.remove('maplibregl-compact-show');
  });
  mapa.touchZoomRotate.disableRotation();

  /*
   * Překreslit po každé změně rozměru rámu.
   *
   * Knihovna sama sleduje jen změnu velikosti okna. Když se ale změří rám
   * a ten pak vyroste z jiného důvodu — doskáče písmo, zmizí posuvník,
   * přepočítá se `vh` —, plátno zůstane v původní výšce a u spodní hrany
   * zeje tmavý pruh, ve kterém mapa není vykreslená. Vypadá to jako lišta
   * přes mapu, ale je to prostě nedokreslené místo.
   */
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => mapa.resize()).observe(prvek);
  }

  // Když je ve stylu chyba, knihovna vrstvu tiše zahodí a mapa zůstane
  // prázdná, aniž by kdekoliv něco svítilo. Tohle to aspoň napíše do konzole.
  mapa.on('error', (udalost) => console.error('Mapa:', udalost.error?.message ?? udalost));

  return mapa;
}

/**
 * Obdélník kolem zadaných bodů, o kousek větší.
 *
 * Používá se na tlačítko „celá obec" nebo „celé město": mapa se má vejít
 * přesně na to, co je na ní zajímavé, ne na obdélník stažených dlaždic.
 */
export function hraniceBodu(
  body: { lat: number; lon: number }[],
): [[number, number], [number, number]] {
  if (!body.length) return HRANICE_DLAZDIC;
  let jih = Infinity;
  let sever = -Infinity;
  let zapad = Infinity;
  let vychod = -Infinity;
  for (const b of body) {
    if (b.lat < jih) jih = b.lat;
    if (b.lat > sever) sever = b.lat;
    if (b.lon < zapad) zapad = b.lon;
    if (b.lon > vychod) vychod = b.lon;
  }
  return [
    [zapad, jih],
    [vychod, sever],
  ];
}
