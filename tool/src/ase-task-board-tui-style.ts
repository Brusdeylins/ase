/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import type { BoxProps, TextProps }           from "ink"

import type Log                                from "./ase-lib-log.js"
import { Config }                              from "./ase-config-core.js"
import { configSchema, tuiColorDefaults }      from "./ase-config-schema.js"

/*  the color palette of the terminal board, with the four roles dim,
    normal, accent, and signal (undefined is the terminal foreground color),
    configurable through the "board.tui.color.<role>" configuration keys  */
type Palette = { dim?: string, normal?: string, accent?: string, signal?: string }
export let palette: Palette = {}

/*  the dashed border of the "CANCELLED" lane  */
export const dashed: BoxProps["borderStyle"] = {
    topLeft: "╭", top: "╌", topRight: "╮", right: "╎",
    bottomRight: "╯", bottom: "╌", bottomLeft: "╰", left: "╎"
}

/*  the heavy variant of the dashed border, for marking a move target  */
export const dashedBold: BoxProps["borderStyle"] = {
    topLeft: "┏", top: "╍", topRight: "┓", right: "╏",
    bottomRight: "┛", bottom: "╍", bottomLeft: "┗", left: "╏"
}

/*  the style sheet of the terminal board: named classes of Box or Text
    properties, derived from the palette, to be combined with cx()  */
const sheet = (p: Palette) => ({
    /*  text colors and decorations  */
    "dim":                 { color: p.dim },
    "normal":              { color: p.normal },
    "accent":              { color: p.accent },
    "signal":              { color: p.signal },
    "bold":                { bold: true },
    "inverse":             { inverse: true },
    "badge":               { bold: true, inverse: true },
    "dimmed":              { dimColor: true },
    "truncate":            { wrap: "truncate" },
    "hint":                { color: p.dim, wrap: "truncate" },

    /*  text components  */
    "group-head":          { color: p.normal, inverse: true, wrap: "truncate" },
    "group-head-selected": { color: p.signal, bold: true },
    "button":              { color: p.normal, bold: true, inverse: true },
    "button-active":       { color: p.signal },

    /*  box borders  */
    "frame":               { borderStyle: "round" },
    "border-dim":          { borderColor: p.dim },
    "border-accent":       { borderColor: p.accent },
    "border-signal":       { borderColor: p.signal },
    "border-dimmed":       { borderDimColor: true },

    /*  box layouts  */
    "column":              { flexDirection: "column" },
    "fixed":               { flexShrink: 0 },
    "grow":                { flexGrow: 1 },
    "bar":                 { paddingX: 1, justifyContent: "center" },
    "popup":               { position: "absolute", flexDirection: "column", borderStyle: "round" },

    /*  the tones of the graph view  */
    "tone-sel":            { color: p.signal, bold: true },
    "tone-sel-frame":      { color: p.signal },
    "tone-sel-title":      { color: p.signal },
    "tone-sel-id":         { color: p.signal, bold: true, inverse: true },
    "tone-done":           { color: p.dim },
    "tone-done-frame":     { color: p.dim },
    "tone-done-title":     { color: p.dim },
    "tone-done-id":        { color: p.dim, bold: true, inverse: true },
    "tone-active":         { color: p.accent },
    "tone-active-frame":   { color: p.accent },
    "tone-active-title":   { color: p.accent },
    "tone-active-id":      { color: p.accent, bold: true, inverse: true },
    "tone-idle":           { color: p.normal },
    "tone-idle-frame":     { color: p.normal },
    "tone-idle-title":     { color: p.normal },
    "tone-idle-id":        { color: p.normal, bold: true, inverse: true },
    "tone-edge":           { color: p.dim },
    "tone-edge-sel":       { color: p.signal }
}) satisfies Record<string, BoxProps | TextProps>
export type ClassName = keyof ReturnType<typeof sheet>
let classes = sheet(palette)

/*  load the palette from the configuration and derive the style sheet from it  */
export const loadPalette = (log: Log): void => {
    const cfg = new Config("config", configSchema, log)
    cfg.read()
    const color = (role: keyof Palette): string | undefined => {
        const value = cfg.get(`board.tui.color.${role}`)
        const name  = typeof value === "string" ? value : tuiColorDefaults[role]
        return name === "default" ? undefined : name
    }
    palette = { dim: color("dim"), normal: color("normal"), accent: color("accent"), signal: color("signal") }
    classes = sheet(palette)
}

/*  check whether a (dynamically constructed) name is a class of the style sheet  */
export const isClass = (name: string): name is ClassName =>
    Object.hasOwn(classes, name)

/*  merge the properties of the given classes (skipping falsy entries for
    conditional classes), with later classes overriding earlier ones  */
export const cx = (...names: (ClassName | false | null | undefined)[]): BoxProps & TextProps => {
    const style = {} as Record<string, unknown>
    for (const name of names)
        if (typeof name === "string")
            Object.assign(style, classes[name])
    return style as BoxProps & TextProps
}

