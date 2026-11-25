/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { ResttyFontInput, GhosttyTheme } from "restty"

/*  the terminal emulator, loaded on first use (and prefetched once a task dialog opens)  */
type Emulator = typeof import("./ase-task-board-web-client-restty")
let emulator: Promise<Emulator> | null = null
export const loadEmulator = (): Promise<Emulator> => {
    emulator ??= import("./ase-task-board-web-client-restty")
    return emulator
}

/*  the fonts of the terminal, served by the board as TrueType files, as the terminal emulator decodes WOFF2 files
    wrongly (JetBrains Mono, with the Noto fonts for the symbols, mathematical symbols and arrows, further signs, and emojis the agent tool and ASE print), and without any local
    font, as the access to them has to be granted by the user  */
const font = (file: string, name: string, weight = 400, style: "normal" | "italic" = "normal"): ResttyFontInput =>
    ({ url: `/task-board/font/${file}`, name, weight, style })
export const terminalFonts: ResttyFontInput[] = [
    font("JetBrainsMono_400Regular.ttf",        "JetBrains Mono Regular"),
    font("JetBrainsMono_700Bold.ttf",           "JetBrains Mono Bold",        700),
    font("JetBrainsMono_400Regular_Italic.ttf", "JetBrains Mono Italic",      400, "italic"),
    font("JetBrainsMono_700Bold_Italic.ttf",    "JetBrains Mono Bold Italic", 700, "italic"),
    font("NotoSansSymbols_400Regular.ttf",      "Noto Sans Symbols"),
    font("NotoSansSymbols2_400Regular.ttf",     "Noto Sans Symbols 2"),
    font("NotoSansMath_400Regular.ttf",         "Noto Sans Math"),
    font("NotoSansMono_400Regular.ttf",         "Noto Sans Mono"),
    font("NotoEmoji_400Regular.ttf",            "Noto Emoji")
]

/*  load the terminal emulator, initialize its WebAssembly module, and fetch its fonts into the browser
    cache, so a terminal opened later starts at once (once only)  */
let prefetched = false
export const prefetchEmulator = (): void => {
    if (prefetched)
        return
    prefetched = true
    loadEmulator().then((e) => e.warm()).catch(() => {
        prefetched = false
        emulator   = null
    })
    for (const f of terminalFonts)
        if (typeof f === "object" && "url" in f && typeof f.url === "string")
            fetch(f.url).catch(() => {})
}

/*  ==== theme ====  */

/*  an RGB color, with 8 bit components  */
type RGB = { r: number, g: number, b: number }

/*  resolve any CSS color (as a computed CSS variable of the board is) into its RGB components  */
const rgbOf = (value: string): RGB => {
    const probe = document.createElement("span")
    probe.style.color = value
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    const n     = (color.match(/[\d.]+/g) ?? [ "0", "0", "0" ]).map(Number)
    const scale = color.startsWith("color(") ? 255 : 1
    return { r: Math.round(n[0] * scale), g: Math.round(n[1] * scale), b: Math.round(n[2] * scale) }
}

/*  the RGB color of a CSS variable of the board, resolved against the current color theme  */
const variable = (name: string): RGB =>
    rgbOf(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000")

/*  the lightness of a color (0-255)  */
const luma = (c: RGB): number =>
    0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

/*  whether the board currently shows its dark color theme (whatever "board.web.theme" or the cycling of the theme
    chose, even "auto", which follows the system)  */
export const terminalDark = (): boolean =>
    luma(variable("--c-paper")) < 128

/*  the background of the terminal: the paper of the board in its light theme, and pure black in its dark theme  */
const background = (): RGB =>
    terminalDark() ? { r: 0, g: 0, b: 0 } : variable("--c-paper")
export const terminalPaper = (): string => {
    const c = background()
    return `rgb(${c.r}, ${c.g}, ${c.b})`
}

/*  the built-in themes of the terminal emulator providing the 16 ANSI colors, as proven palettes (the ones of
    GitHub, whose colors stay readable on both the black and the white background)  */
export const terminalPalette = (dark: boolean): string =>
    dark ? "GitHub Dark Default" : "GitHub Light Default"

/*  the conversion of a color from and to hue, saturation, and lightness  */
const toHSL = (c: RGB): [ number, number, number ] => {
    const [ r, g, b ] = [ c.r / 255, c.g / 255, c.b / 255 ]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l   = (max + min) / 2
    const d   = max - min
    if (d === 0)
        return [ 0, 0, l ]
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return [ (h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l ]
}
const fromHSL = (h: number, s: number, l: number): RGB => {
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min((n + h / 30) % 12 - 3, 9 - (n + h / 30) % 12, 1))))
    return { r: f(0), g: f(8), b: f(4) }
}

/*  the WCAG contrast ratio of two colors  */
const contrast = (a: RGB, b: RGB): number => {
    const channel = (v: number): number => v / 255 <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4
    const lum = (c: RGB): number => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
    const [ hi, lo ] = [ lum(a), lum(b) ].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

/*  the uses of the 16 ANSI slots by the agent tool in its "-ansi" themes, read from their definitions (the colors of its theme keys)
    and from its captured output: the slot of its inverse text (drawn on the colored labels), the pairs of a foreground and a background
    slot (the inverse text on the labels, and the text on the message, memory, sidebar, selection, and diff backgrounds, and the logo), the slots
    used as text on the background of the terminal, and of these the dimmed ones (needing less contrast)  */
type Uses = { inverse: number, pairs: [ number, number ][], text: number[], dim: number[] }
const usesDark: Uses = {
    inverse: 0,
    pairs:   [ [ 0, 4 ], [ 0, 9 ], [ 0, 10 ], [ 0, 11 ], [ 0, 12 ], [ 0, 13 ], [ 0, 14 ], [ 0, 15 ], [ 9, 0 ], [ 15, 0 ], [ 15, 1 ], [ 15, 2 ], [ 15, 4 ], [ 15, 8 ], [ 15, 9 ], [ 15, 10 ] ],
    text:    [ 4, 7, 9, 10, 11, 12, 13, 14, 15 ],
    dim:     [ 7 ]
}
const usesLight: Uses = {
    inverse: 7,
    pairs:   [ [ 0, 1 ], [ 0, 2 ], [ 0, 6 ], [ 0, 7 ], [ 0, 9 ], [ 0, 10 ], [ 0, 15 ], [ 7, 1 ], [ 7, 2 ], [ 7, 3 ], [ 7, 4 ], [ 7, 5 ], [ 7, 6 ], [ 7, 9 ], [ 7, 12 ], [ 9, 0 ] ],
    text:    [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13 ],
    dim:     [ 7, 8 ]
}

/*  the 16 ANSI colors for a background of the terminal: the colors of the palette, with the blue, bright blue, red, bright red, and bright
    black ones starting from the accent, signal, and dim roles of the board (resolved from its CSS variables), each adjusted as little as possible
    (first the "strong" shade of the board for the bright ones, then its lightness stepped in either direction) until all uses by the agent
    tool (see above) have a contrast of at least 4.5 (3.0 for dimmed text), where the hard uses are the text on the background of the
    terminal (but for dimmed text) and the inverse text on the labels, and the soft ones the text on the message, memory, selection, and diff
    backgrounds, the logo, and dimmed text, which give way where they conflict with the hard ones (e.g. the "white" of the light theme, used as the
    inverse text on labels but also as dimmed text); a bright color has to be visibly distinct from its normal one; the slots are adjusted in passes
    of coordinate descent (fewest violations of hard uses, then of soft uses, then the smallest change) until stable, and what stays violated is reported  */
type Roles = Record<"accent" | "accentStrong" | "signal" | "signalStrong" | "mute", RGB>
export type Mapping = { slot: number, color: RGB, source: string, lowest: number, violated: string[] }[]
export const terminalMapping = (roles: Roles, bg: RGB, palette: RGB[]): { palette: RGB[], mapping: Mapping } => {
    const uses     = luma(bg) < 128 ? usesDark : usesLight
    const distinct = (a: RGB, b: RGB): boolean => Math.abs(luma(a) - luma(b)) >= 20
    const rival    = (slot: number): number => ({ 4: 12, 12: 4, 1: 9, 9: 1 } as Record<number, number>)[slot] ?? -1
    const start    = palette.slice()
    start[4] = roles.accent; start[12] = roles.accentStrong; start[1] = roles.signal; start[9] = roles.signalStrong; start[8] = roles.mute
    const shades   = new Map<number, RGB>([ [ 12, roles.accentStrong ], [ 9, roles.signalStrong ] ])
    const colors   = start.slice()
    const sources: string[] = colors.map((_c, i) => i === 4 || i === 1 || i === 8 ? "role" : i === 12 || i === 9 ? "board" : "palette")
    const minText  = (slot: number): number => uses.dim.includes(slot) || slot === 8 ? 3.0 : 4.5

    /*  the uses of a slot given the other colors: their shortfalls (a negative one if met) of hard and soft ones, and a description  */
    const measure = (slot: number, c: RGB): { hard: number[], soft: number[], names: [ string, number ][] } => {
        const hard: number[] = []
        const soft: number[] = []
        const names: [ string, number ][] = []
        for (const [ f, b ] of uses.pairs)
            if (f === slot || b === slot) {
                const ratio = contrast(f === slot ? c : colors[f], b === slot ? c : colors[b])
                ;(f === uses.inverse ? hard : soft).push(4.5 - ratio)
                names.push([ `${f}/${b}`, ratio ])
            }
        if (uses.text.includes(slot)) {
            const ratio = contrast(c, bg)
            ;(uses.dim.includes(slot) ? soft : hard).push(minText(slot) - ratio)
            names.push([ "text", ratio ])
        }
        const r = rival(slot)
        if (r >= 0 && !distinct(c, colors[r])) {
            hard.push(5)
            names.push([ "distinct", 0 ])
        }
        return { hard, soft, names }
    }
    let withSoft = false
    const score = (slot: number, c: RGB, origin: RGB): [ number, number, number ] => {
        const { hard, soft } = measure(slot, c)
        if (!withSoft)
            soft.length = 0
        const [ , , l0 ] = toHSL(origin)
        const [ , , l1 ] = toHSL(c)
        return [ hard.reduce((n, x) => n + Math.max(0, x), 0), soft.filter((x) => x > 0).length, Math.abs(l1 - l0) ]
    }
    const better = (a: number[], b: number[]): boolean => {
        for (let i = 0; i < 3; i++)
            if (Math.abs(a[i] - b[i]) > 1e-9)
                return a[i] < b[i]
        return false
    }
    /*  the slot of the inverse text starts at the extreme of the lightness range (white on a light, black on a dark background), as
        it has to be contrasted with all the labels  */
    colors[uses.inverse] = luma(bg) < 128 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
    sources[uses.inverse] = "adjusted"
    for (const soft of [ false, true ]) {
        withSoft = soft
        for (let pass = 0; pass < 40; pass++) {
            let changed = false
            for (let slot = 0; slot < 16; slot++) {
                const [ h, s, l ] = toHSL(start[slot])
                const list: [ RGB, string ][] = [ [ start[slot], slot === 4 || slot === 1 || slot === 8 ? "role" : slot === 12 || slot === 9 ? "board" : "palette" ] ]
                const shade = shades.get(slot)
                if (shade !== undefined && slot !== 12 && slot !== 9)
                    list.push([ shade, "board" ])
                for (let i = 1; i <= 100; i++)
                    for (const d of [ 1, -1 ])
                        if (l + d * i * 0.01 >= 0 && l + d * i * 0.01 <= 1)
                            list.push([ fromHSL(h, s, l + d * i * 0.01), "adjusted" ])
                let best = score(slot, colors[slot], start[slot])
                let pick: [ RGB, string ] | null = null
                for (const entry of list) {
                    const sc = score(slot, entry[0], start[slot])
                    if (better(sc, best)) {
                        best = sc
                        pick = entry
                    }
                }
                if (pick !== null) {
                    colors[slot]  = pick[0]
                    sources[slot] = pick[1]
                    changed       = true
                }
            }
            if (!changed)
                break
        }
    }
    const mapping: Mapping = colors.map((color, slot) => {
        const { names } = measure(slot, color)
        const violated  = names.filter(([ n, r ]) => r < (n === "text" ? minText(slot) : n === "distinct" ? 1 : 4.5)).map(([ n, r ]) => `${n} ${r.toFixed(2)}`)
        return { slot, color, source: sources[slot], lowest: Math.min(...names.filter(([ n ]) => n !== "distinct").map(([ , r ]) => r)), violated }
    })
    return { palette: colors, mapping }
}

/*  the color theme of the terminal emulator: its background, foreground (the text of the board), cursor
    (its signal color), and selection from the color roles of the board (resolved from its CSS variables each
    time, so it follows the color theme chosen), and the 16 ANSI colors of the given built-in theme, where its
    blue, red, and bright black ones are replaced by the accent, signal, and dim colors of the board (see above)  */
export const terminalTheme = (builtin: GhosttyTheme): GhosttyTheme => {
    const paper = background()
    const text  = variable("--c-text")
    const base  = builtin.colors.palette.slice(0, 16).map((c) => c ?? { r: 0, g: 0, b: 0 })
    const { palette } = terminalMapping({
        accent: variable("--c-accent"), accentStrong: variable("--c-accent-strong"),
        signal: variable("--c-signal"), signalStrong: variable("--c-signal-strong"), mute: variable("--c-mute")
    }, paper, base)
    return {
        colors: {
            background:          paper,
            foreground:          text,
            cursor:              variable("--c-signal"),
            cursorText:          paper,
            selectionBackground: variable("--c-accent-fill"),
            selectionForeground: text,
            palette
        },
        raw: {}
    }
}
