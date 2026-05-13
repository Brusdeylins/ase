/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
*/

/*  monochrome palette with single accent — used by both Markdown (link styling
    where MD allows it) and HTML (CSS + Mermaid themeVariables)  */

export const THEME = {
    bg:      "#ffffff",
    fg:      "#111111",
    fgMuted: "#666666",
    border:  "#cccccc",
    subtle:  "#f5f5f5",
    accent:  "#a01441"
} as const

export const MERMAID_THEME_VARIABLES = {
    primaryColor:        THEME.bg,
    primaryTextColor:    THEME.fg,
    primaryBorderColor:  THEME.fgMuted,
    lineColor:           THEME.fgMuted,
    secondaryColor:      THEME.subtle,
    tertiaryColor:       THEME.bg,
    edgeLabelBackground: THEME.bg,
    classText:           THEME.fg
} as const
