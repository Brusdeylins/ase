/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  Claude Code function hooks module ("mod", EARLY ACCESS):
    Hooking infrastructure, registering the function hooks and dispatching
    them into the grill table ("ase-mods-grill.ts"), the intent help
    ("ase-mods-help-intent.ts"), and the synopsis form ("ase-mods-help-skill.ts").
    As the engine loads only a module spelling "on", "$", and "next" literally,
    this is the only module touching the engine, and it binds the engine
    services needed by the other modules as plain functions.  */

import type { Register, PromptBox } from "claude-code"
import { TRIGGER }       from "./ase-mods-common.ts"
import { modGrill }      from "./ase-mods-grill.ts"
import { modHelpIntent } from "./ase-mods-help-intent.ts"
import { modHelpSkill }  from "./ase-mods-help-skill.ts"

/*  function hook registration entry point  */
export const register: Register = (on, options) => {
    /*  allow the rendering to be disabled without disabling the plugin  */
    if (options.enabled === false)
        return

    /*  the grill table, the intent help, and the synopsis form  */
    const grill  = modGrill()
    const intent = modHelpIntent()
    const skill  = modHelpSkill()

    /*  the generation of the latest submission (ending any older refilling of the prompt)  */
    let submissions = 0

    /*  handle the still unsubmitted prompt of the user: while the intent band
        or the synopsis form is shown, every edit is a key of it, else act on the
        typed trigger suffix at the end of the prompt only (showing the synopsis
        form for a bare skill command with a manual page, else arming the matching
        of the prompt as an intent), and track the picks of the grill table
        inside the edited prompt while neither is shown  */
    on("prompt.edit", async ($, e, next) => {
        const shown = intent.active() || skill.active()
        let box: PromptBox
        if (intent.active()) {
            const result = intent.edit(e)
            box = typeof result !== "string" ? result :
                await next({ ...e, text: result, cursor: result.length, start: result.length, end: result.length })
        }
        else if (skill.active())
            box = skill.edit(e)
        else {
            box = await next(e)
            if (e.inputText.endsWith("?") && box.cursor === box.text.length && TRIGGER.test(box.text)) {
                const read = (file: string) => $.fs.read(`${$.plugin.root}/${file}`)
                box = await skill.open(box, { read }) ?? intent.open(box, {
                    read,
                    invalidate: () => $.ui.invalidate("ui.render"),
                    fork:       (prompt) => $.model.fork({ prompt }),
                    complete:   (request) => $.model.complete(request),
                    sleep:      (ms) => $.clock.sleep(ms)
                }) ?? box
            }
        }
        const held = intent.active() || skill.active()
        if (held || grill.track(box.text) || shown)
            $.ui.invalidate("ui.render")
        return box
    }).catch(($, e, next) => {
        /*  close a failed intent band resp. synopsis form and restore the prompt
            as typed resp. the bare command (instead of the held prompt), else
            let the edit pass  */
        const text = [ intent.cancel(), skill.cancel() ].find((text) => text !== undefined)
        $.ui.invalidate("ui.render")
        return text !== undefined ? { text, cursor: text.length } : next(e)
    })

    /*  operate the synopsis form resp. the intent band by the wheel  */
    on("ui.scroll", { component: "AbovePrompt" }, ($, e, next) => {
        if (!skill.scroll(e) && !intent.scroll(e))
            return next(e)
        $.ui.invalidate("ui.render")
        return {}
    }).catch(($, e, next) =>
        /*  let a failed scrolling of the synopsis form resp. the intent band pass  */
        next(e))

    /*  operate the intent band and the synopsis form by RETURN, resp. freeze the
        picks in the latest table and close the intent band and the synopsis form
        once the prompt is submitted  */
    on("prompt.submit", ($, e, next) => {
        /*  while the intent band or the synopsis form is shown, RETURN at the prompt
            (which usually arrives as an edit of the held prompt instead, so this is
            the fallback only) is a key of it, entering nothing and refilling the
            prompt (immediately, and again whenever the submission cleared it or
            restored the submitted prompt, as a duplicate of or next to the refilled
            one, within a grace period)  */
        if ((intent.active() || skill.active()) && e.origin.kind === "composer") {
            const text = intent.active() ? intent.submit() : skill.submit()
            const generation = ++submissions
            $.ui.invalidate("ui.render")
            const fill = async () => {
                const box = await $.prompt.fill({ text })
                if (!intent.active() && !skill.active()) {
                    grill.refresh(box.text)
                    $.ui.invalidate("ui.render")
                }
            }
            const refill = async () => {
                await fill()
                const prompt    = text.trim()
                const submitted = e.text.trim()
                for (const ms of [ 25, 50, 100, 200, 400 ]) {
                    await $.clock.sleep(ms)
                    const box = (await $.prompt.read()).text
                    if (generation !== submissions)
                        return
                    if (box === "" || box.indexOf(prompt) !== box.lastIndexOf(prompt)
                        || (submitted !== prompt && box.includes(submitted)))
                        await fill()
                }
            }
            refill().catch(() => {
                /*  ignore a prompt which is no longer accessible  */
            })
            return { text: e.text }
        }

        /*  let any other submission (like a task notification) pass while the
            intent band or the synopsis form is shown, as it leaves the held
            prompt in place  */
        if (intent.active() || skill.active())
            return next(e)

        submissions++
        grill.submit(e.text)
        intent.reset()
        skill.reset()
        $.ui.invalidate("ui.render")
        return next(e)
    }).catch(($, e, next) =>
        /*  never let a failed RETURN of the intent band or synopsis form enter the prompt  */
        next.called || (!intent.active() && !skill.active()) ? next(e) :
            { drop: "intent band or synopsis form failed" })

    /*  redraw the replies which contain a grilling table (terminal only), where
        the chain beneath runs, although its drawing is replaced by us (but this
        at least silences a warning in the debug output of Claude Code)  */
    on("ui.render", { component: "AssistantMessage", surface: "terminal" }, async ($, e, next) => {
        const drawn = await next(e)
        return grill.render(e, $.ui.resolve(e), {
            invalidate: () => $.ui.invalidate("ui.render"),
            prompt:     () => $.prompt.read(),
            fill:       (text) => $.prompt.fill({ text })
        }) ?? drawn
    })

    /*  draw the intent band resp. the synopsis form into the band above the prompt (terminal only)  */
    on("ui.render", { component: "AbovePrompt", surface: "terminal" }, async ($, e, next) => {
        const drawn = await next(e)
        const ui    = $.ui.resolve(e)
        return intent.render(e, ui) ?? skill.render(e, ui) ?? drawn
    }).catch(($, e, next) => {
        /*  close a failed intent band resp. synopsis form, restore the prompt as
            typed resp. the bare command (instead of the held prompt), and keep
            the drawing beneath  */
        const text = [ intent.cancel(), skill.cancel() ].find((text) => text !== undefined)
        if (text !== undefined)
            $.prompt.fill({ text }).catch(() => {
                /*  ignore a prompt which is no longer accessible  */
            })
        return next(e)
    })
}

