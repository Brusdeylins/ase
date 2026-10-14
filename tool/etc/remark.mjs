/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

/*  external requirements  */
import fs        from "node:fs"
import remarkMan from "remark-man"

/*  determine the version of the tool  */
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))

/*  render the Markdown manual pages "man/*.md" into Unix roff manual pages "*.<section>"  */
const remarkManFile = () => (_tree, file) => {
    const m = /^.+?\((\d+)\)/.exec(String(file.value).split(/\r?\n/)[0] ?? "")
    file.extname = `.${m !== null ? m[1] : "1"}`
}

/*  fix the indentation of the subsequent paragraphs and code blocks of a list item,
    as "remark-man" emits them with ".P" (which resets the indentation of the list item
    of ".IP") resp. ".RS 2" (which indents them less than the list item text); a
    paragraph following a nested list has to re-establish the indentation via ".IP",
    as the ".RE" of the nested list drops it  */
const remarkManIndent = function () {
    const compiler = this.compiler
    this.compiler = (tree, file) => {
        const lines = String(compiler(tree, file)).split("\n")
        const stack = []
        let nested = false
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const inItem = stack.length > 0 && stack[stack.length - 1] === "item"
            if (/^\.RS\b/.test(line)) {
                if (/^\.IP\b/.test(lines[i + 1] ?? ""))
                    stack.push("list")
                else {
                    if (stack.includes("item") && /^\.RS 2$/.test(line))
                        lines[i] = ".RS 6"
                    stack.push("block")
                }
            }
            else if (/^\.RE\b/.test(line)) {
                nested = stack.pop() !== "block" && stack.length > 0 && stack[stack.length - 1] === "item"
                continue
            }
            else if (/^\.IP\b/.test(line) && stack.length > 0 && stack[stack.length - 1] !== "block")
                stack[stack.length - 1] = "item"
            else if (line === ".P" && inItem)
                lines[i] = nested ? ".IP \"\" 4" : ".sp"
            if (line !== "")
                nested = false
        }

        /*  drop the empty lines "remark-man" emits after a ".RE", as roff renders
            them as additional vertical space  */
        return lines.filter((line, i) => !(line === "" && i > 0 && /^\.RE\b/.test(lines[i - 1])))
            .join("\n")
    }
}

/*  export remark configuration  */
export default {
    plugins: [
        [ remarkMan, { version: pkg.version, manual: "Agentic Software Engineering (ASE)" } ],
        remarkManIndent,
        remarkManFile
    ]
}

