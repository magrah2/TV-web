---
# ŠABLONA PRO NOVÝ BOD NA MAPĚ ZÁMĚRŮ
#
# Jak přidat místo:
#   1. Zkopírujte tenhle soubor a pojmenujte kopii `<číslo>-<nazev>.md`,
#      třeba `15-parkovaci-dum.md`. Číslo určuje jen pořadí v seznamu
#      a na mapě — mezery v číslování nevadí a nic se nepřečísluje.
#   2. Vyplňte řádky níž a pod čárou napište text.
#   3. Hotovo. Nic dalšího se nikde nevypisuje.
#
# Soubory začínající podtržítkem se přeskakují, takže tahle šablona
# na web nikdy nejde.

# Název místa. Ukáže se v seznamu vedle mapy — krátce, ať se vejde na řádek.
nazev: Název místa

# Programová oblast. Určuje barvu bodu a to, pod kterým filtrem se ukáže.
# Musí to být přesně jedna z hodnot v src/lib/temata.ts:
#   Hospodaření · Bydlení · Zeleň a voda · Podnikání
#   Školství · Bezpečnost · Kultura · Doprava
# Překlep shodí sestavení, takže si toho všimneme my, ne návštěvník.
tema: Zeleň a voda

# Zeměpisné souřadnice. Nejsnáz na mapy.cz: pravý klik na místo →
# „Kopírovat souřadnice". Zapisují se jako lat (severní šířka) a lon
# (východní délka), tedy 49.xxxxx a 16.xxxxx nebo 17.xxxxx.
#
# Procenta se sem nepíšou schválně: platila by jen pro jeden výřez mapy,
# takže po jejím oddálení by se všechny body rozjely. Polohu si web
# dopočítá sám (src/lib/mapa.ts).
#
# Když bod padne mimo mapu, sestavení skončí chybou a řekne to.
lat: 49.27789
lon: 16.99954

# `navrh` = text zatím nikdo z týmu nepotvrdil. Bod se vykreslí s viditelnou
# značkou „návrh", aby si ho nikdo nespletl se závazkem.
# Až text potvrdíte, přepište na `overeno` a značka zmizí.
stav: navrh
---

Sem patří text. První odstavec říká, jak to na tom místě vypadá dnes —
co tam člověk uvidí, když se tam půjde podívat.

Druhý odstavec říká, co tam chceme udělat. Ideálně tak, aby to vycházelo
z programu — co v programu není, nemá se za program vydávat.
