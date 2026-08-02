/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  curated practitioner testimonials

    Each entry carries one endorsement of ASE, optionally attributed to a named
    practitioner. Only *real*, *attributed*, and *consented* quotes belong here
    -- never invent a testimonial and never attach one to a person who did not
    give it. As long as this list is empty, `Section-Testimonials.astro`
    renders nothing at all, so the front page never shows a placeholder
    endorsement.

    The `Section-Testimonials.astro` component rotates the entries one at a
    time, so the order below is also the rotation order on the page. The
    `quote` is rendered as plain text (no markup), wrapped in typographic
    quotation marks by the component itself.  */

export type Testimonial = {
    quote: string   /*  the endorsement itself, as plain text            */
    name?: string   /*  optional name of the endorsing practitioner      */
}

export const testimonials: Testimonial[] = [
    {
        quote: "After 40 years of traditional software development, " +
               "ASE finally allowed me to make peace with todays Agentic AI Coding era.",
        name:  "Dr. Ralf S. Engelschall"
    },
    {   quote: "Thanks to Agentic AI Coding, developing software is fun again. "+
               "ASE is a great added bonus here!",
        name:  "Matthias Brusdeylins"
    },
    {   quote: "Finally, I get to work with a professional again. " +
               "ASE is that long-awaited professional.",
        name:  "Jochen Hörtreiter"
    },
    {   quote: "I use ASE in GitHub Copilot CLI and here especially the various " +
               "non-coding skills. They work great, even for consulting tasks!",
        name:  "Zoltan Ruzman"
    },
    {   quote: "ASE keeps me in the driver's seat while the agent does the chores."
    }
]

