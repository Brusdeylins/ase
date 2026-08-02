/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  the "Fit Check" self-qualification entries

    ASE is deliberately opinionated, so it inherently fits some people and
    inherently repels others. The two lists below state this plainly instead of
    leaving the visitor to discover it after installing: `fitFor` restates the
    documented design assumptions from the visitor's point of view, `fitAgainst`
    states the honest boundaries and the non-goals.

    The `body` texts carry the same lightweight inline HTML the other data
    modules use, so the section renders them via `set:html`.  */

export type Fit = {
    title: string  /*  short, bold headline of the qualification criterion  */
    body:  string  /*  one- to two-sentence elaboration of the criterion    */
}

export const fitFor: Fit[] = [
    {
        title: "You want to stay in the driver's seat",
        body:  "You decide and trigger the next operation, and you review what came back. " +
               "<b>ASE</b> hands you the wheel — it does not take it."
    },
    {
        title: "You are an experienced developer or architect",
        body:  "You can tell a good result from a plausible one. <b>ASE</b> raises the " +
               "<i>ceiling</i> of what you produce; it does not raise the <i>floor</i> of what you know."
    },
    {
        title: "You prefer thinking before acting",
        body:  "You accept an approach funnel and a written plan before the first line changes, " +
               "because post-hoc repair of a wrong change set costs more than the detour."
    },
    {
        title: "You have to defend your decisions",
        body:  "Component picks, architecture calls, and refactorings get challenged sooner or later. " +
               "<b>ASE</b> hands you weighted decision matrices, an <i>Advocatus Diaboli</i>, and a " +
               "<i>Steelman</i> — so you arrive with reasoning instead of a hunch."
    },
    {
        title: "You like the Unix command-line style",
        body:  "<b>ASE</b> skills are explicit commands with Unix-style options, like " +
               "<code>/ase-code-craft --next IMPLEMENT</code> — not a chat you nudge until it complies."
    },
    {
        title: "You run Claude Code CLI with a strong LLM",
        body:  "<b>ASE</b> is primarily developed against <b>Anthropic Claude Code CLI</b> plus " +
               "<b>Claude Opus</b> or <b>Claude Fable</b>, and needs that class of instruction-following."
    }
]

export const fitAgainst: Fit[] = [
    {
        title: "You want plain Vibe Coding",
        body:  "If \"prompt it, ship it, never read it\" is your goal, <b>ASE</b> only adds " +
               "ceremony you will route around anyway."
    },
    {
        title: "You want a fully autonomous agent fleet",
        body:  "<b>ASE</b> deliberately keeps a human in the loop at every decision point. " +
               "It, by default, is not an unattended, self-dispatching swarm, even it can be forced to it to some extend."
    },
    {
        title: "You do consulting, operations, or management",
        body:  "<b>ASE</b> primarily targets the recurring tasks of <i>Software Engineering</i>, " +
               "although various skills are also useful outside this scope."
    },
    {
        title: "You optimize for the smallest token bill",
        body:  "Methodology costs tokens: a preloaded constitution, on-demand meta descriptions, " +
               "approach funnels, and plans. Even if the <code>persona</code> setting can trim the output tokens, stringency has its price."
    },
    {
        title: "You want an unopinionated framework",
        body:  "<b>ASE</b> ships strict artifact formats, fixed skill families, and built-in tenets. " +
               "You can configure it to some extend, but you cannot make it neutral."
    },
    {
        title: "You are on a weak LLM or a non-mainstream harness",
        body:  "<b>ASE</b> leans on elaborate control constructs and XML placeholders. Weaker models " +
               "and non-mainstream harnesses follow them only partially."
    }
]
