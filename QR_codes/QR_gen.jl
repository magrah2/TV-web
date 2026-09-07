# QR kódy na tiskoviny. Znak jde do okna v prostředku, moduly se barví po
# úhlopříčce (vlevo nahoře modrá, vpravo dole zelená).
#
#     julia QR_gen.jl                  # jen varianta "logo"
#     julia QR_gen.jl cerny bez-znaku  # vybrané varianty
#     julia QR_gen.jl vse              # všechny tři
#
# Při jedné variantě se soubory jmenují QR_web.svg, při víc jich dostanou
# příponu podle varianty (QR_web_cerny.svg).

using QRCoders

# Titulní strana je velkými písmeny schválně: doména je case-insensitive a
# velká písmena pustí kód do alfanumerického režimu, tedy o verzi menší kód.
# U programu to NEJDE — /PROGRAM/ je cesta na Linuxu a vrátila by 404.
const CILE = [
    ("QR_web",     "HTTPS://TRANSPARENTNIVYSKOV.CZ"),
    ("QR_program", "https://transparentnivyskov.cz/program/"),
]

# Varianty výstupu. Stejné barvy v obou polích znamenají jednobarevný kód.
#
# Korekce chyb se řídí tím, jestli je uvnitř znak. Se znakem musí být High:
# zakryté moduly jsou poškození a korekce je musí dopočítat. Bez znaku není
# co dopočítávat, takže stačí Quartile (25 %, běžný standard pro tisk) —
# a kód je díky tomu o verzi menší, tedy má větší a lépe čitelné moduly.
#
# Zelená z loga má na bílé kontrast 2,9 : 1. Čtečka si obrázek převádí na
# černobílý podle světlosti, takže kdyby některý barevný kód nešel přečíst,
# hledá se tady.
const VARIANTY = [
    "logo"      => (barvy = ("#1d6eb0", "#5bae39"), znak = true,  korekce = High()),
    "cerny"     => (barvy = ("#111111", "#111111"), znak = true,  korekce = High()),
    "bez-znaku" => (barvy = ("#111111", "#111111"), znak = false, korekce = Quartile()),
]

const OKRAJ = 3           # klidová zóna; 4 moduly jsou minimum normy
const PODIL = 0.25        # šířka znaku vůči šířce kódu
const PX = 1200           # cílová šířka PNG
const ZNAK = joinpath(@__DIR__, "..", "src", "assets", "logo", "znak.svg")

# Vodorovné běhy se slepí do jednoho tahu, jinak mezi sousedními <rect>
# prosvítají vlasové čáry.
function tahy(maska)
    kusy = String[]
    for r in axes(maska, 1)
        c = 1
        while c <= size(maska, 2)
            if maska[r, c]
                z = c
                while c <= size(maska, 2) && maska[r, c]; c += 1; end
                push!(kusy, "M$(z-1) $(r-1)h$(c-z)v1h-$(c-z)z")
            else
                c += 1
            end
        end
    end
    join(kusy)
end

# Znak se čte z repozitáře, aby změna značky prošla i do kódů. Třídy z <style>
# se přepíšou na fill — vnořený <style> by platil pro celý dokument.
function nacti_znak()
    text = read(ZNAK, String)
    vb = match(r"viewBox=\"([^\"]+)\"", text).captures[1]
    telo = match(r"<svg[^>]*>(.*)</svg>"s, text).captures[1]
    for m in eachmatch(r"\.([\w-]+)\s*\{[^}]*?fill:\s*([^;}\s]+)"s, text)
        telo = replace(telo, "class=\"$(m.captures[1])\"" => "fill=\"$(m.captures[2])\"")
    end
    rozm = parse.(Float64, split(vb))
    (vb = vb, pomer = rozm[3] / rozm[4],
     telo = strip(replace(telo, r"<defs>.*?</defs>"s => "")))
end

function sestav(matice, zn, varianta)
    n = size(matice, 1)
    kod = n - 2 * OKRAJ
    px = max(1, cld(PX, n)) * n   # celé pixely na modul, jinak se hrany rozmažou

    viditelne, okno = matice, ""
    if varianta.znak
        # Okno se zaokrouhlí na nepárový počet modulů (`| 1`), aby jeho hrana
        # ležela na mřížce a sedělo na střed kódu. Rohy ostré.
        vs = ceil(Int, PODIL * kod + 1) | 1
        vv = ceil(Int, PODIL * kod / zn.pomer + 1) | 1
        x, y = (n - vs) ÷ 2, (n - vv) ÷ 2

        # Moduly pod znakem se NEKRESLÍ, místo aby se překryly bílým
        # obdélníkem. Překrytí dělalo v prohlížeči tmavý obrys kolem znaku:
        # moduly mají `crispEdges` a drží se pixelů, bílý obdélník se
        # antialiasuje, a tak zpod něj po zlomku pixelu vykoukly.
        viditelne = matice .& [!(x < c <= x + vs && y < r <= y + vv) for r in 1:n, c in 1:n]
        okno = """<svg x="$(x+0.5)" y="$(y+0.5)" width="$(vs-1)" height="$(vv-1)" """ *
               """viewBox="$(zn.vb)" preserveAspectRatio="xMidYMid meet">$(zn.telo)</svg>"""
    end

    modra, zelena = varianta.barvy
    # Rozhoduje střed modulu: (c-0,5)+(r-0,5) <= n, tedy c+r <= n+1.
    horni = [c + r <= n + 1 for r in 1:n, c in 1:n]
    cesty = modra == zelena ? [(modra, viditelne)] :
            [(modra, viditelne .& horni), (zelena, viditelne .& .!horni)]

    join(filter(!isempty, [
        """<svg xmlns="http://www.w3.org/2000/svg" width="$px" height="$px" viewBox="0 0 $n $n">""",
        """<rect width="$n" height="$n" fill="#ffffff"/>""",
        ("""<path fill="$b" shape-rendering="crispEdges" d="$(tahy(m))"/>""" for (b, m) in cesty)...,
        okno,
        "</svg>",
    ]), "\n")
end

nazvy = first.(VARIANTY)
vybrane = isempty(ARGS) ? ["logo"] : ("vse" in ARGS ? nazvy : ARGS)
for jm in vybrane
    jm in nazvy || error("Neznama varianta: $jm. K dispozici: " * join(nazvy, ", ") * ", vse")
end

zn = nacti_znak()
soubory = String[]
for (jmeno, adresa) in CILE, nazev in vybrane
    varianta = VARIANTY[findfirst(==(nazev), nazvy)].second
    matice = qrcode(adresa; eclevel = varianta.korekce, width = OKRAJ)
    cesta = joinpath(@__DIR__, jmeno * (length(vybrane) == 1 ? "" : "_" * nazev) * ".svg")
    write(cesta, sestav(matice, zn, varianta))
    push!(soubory, cesta)
    println(rpad(basename(cesta), 26), "verze ", (size(matice, 1) - 2 * OKRAJ - 17) ÷ 4,
            ", ", size(matice, 1), " modulu, korekce ", varianta.korekce)
end

println("\nRasterizuji do PNG...")
try
    run(`node $(joinpath(@__DIR__, "QR_do_png.mjs")) $soubory`)
catch e
    println("PNG se nepodarilo vyrobit: ", e, "\nSVG jsou hotova.")
end
