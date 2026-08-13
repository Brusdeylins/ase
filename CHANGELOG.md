
ChangeLog
=========

0.9.60 (2026-08-09)
-------------------

- FEATURE [code, docs]: added an `--interactive`/`-i` option to `ase-code-craft` which implies `--direct`/`-D` and interactively asks for the next change to craft via a `DONE`-or-free-text dialog, immediately applying each one in place; for this, the custom dialog now permits a single answer option when free-text input is enabled (`ase-code-craft`, `ase-dialog.md`, `usage-plugin.md`)
- IMPROVEMENT [code]: garbage collect orphaned session directories left behind by died agents (`ase-hook.ts`)
- IMPROVEMENT [code]: no longer count and report the number of words of task plans in the skill status lines to speed processing
- UPDATE [infr]: upgraded NPM dependencies (`package.json`)

0.9.59 (2026-08-08)
-------------------

- FEATURE [code]: introduce `ase_worktree_path` for a safe way to discover a worktree path (`ase-worktree.ts`, `ase-service.ts`, `ase.ts`, `ase-code-dissect`, `ase-task-implement`)
- IMPROVEMENT [code]: support arbitrary `<sleep>` and `<await>` durations by chunking them into consecutive 60 second `ase_sleep` calls (`ase-control.md`)
- IMPROVEMENT [infr]: ignore `package-lock.json` files (`.gitignore`)
- BUGFIX [code]: cap the `ase_sleep` duration at 120 seconds (default 60), as Claude Code rejects longer MCP calls (`ase-sleep.ts`)
- BUGFIX [code]: resurrect the unified diff context lines by re-deriving them from the actual file content instead of trusting the sub-agent supplied ones (`ase-code-lint`, `ase-docs-proofread`)

0.9.58 (2026-08-06)
-------------------

- FEATURE [code]: introduce `ase_worktree_path` for a safe way to discover a worktree path
- FEATURE [code]: added the `<sleep>` and `<await>` control flow constructs for waiting a given, possibly fractional, number of seconds once and for waiting until a condition is met, both backed by the new `ase_sleep` MCP tool (`ase-control.md`, `ase-sleep.ts`, `ase-service.ts`)
- FEATURE [code, docs]: added a `--direct`/`-D` option for directly crafting a feature or applying a refactoring in place, without the approach comparison and task plan ceremony (`ase-code-craft`, `ase-code-refactor`, `usage-plugin.md`)
- IMPROVEMENT [code]: keep comments concise by bounding their length and demanding a compaction of the existing wording before an expansion (`ase-constitution.md`)
- BUGFIX [code]: no longer surface a change summary, rationale, or diff after a `--direct`/`-D` run, as the `white` project boxing exposure rules overrode the intended suppression; emit a single `changes directly applied` status line instead (`ase-code-craft`, `ase-code-refactor`, `ase-code-resolve`, `ase-skill.md`)

0.9.57 (2026-08-06)
-------------------

- FEATURE [code]: added a `--direct`/`-D` option for directly applying a problem fix in place, without the approach comparison and task plan ceremony (`ase-code-resolve`)
- IMPROVEMENT [code]: stop the current skill immediately once the task hand-over invoked the `Skill` tool (`ase-common-code.md`)
- IMPROVEMENT [code]: guard against an empty query argument instead of silently proceeding (`ase-meta-chat`)
- IMPROVEMENT [code]: widen the allowed tool sets to the actually required operations (`ase-meta-changelog`, `ase-arch-discover`)
- IMPROVEMENT [code]: log only the first line of an unparsable YAML error in the pruning report (`ase-config.ts`)
- BUGFIX [code]: validate the task id also when setting the active task id of a session, instead of persisting arbitrary strings into `agent.task` (`ase-task.ts`)
- BUGFIX [code, docs]: no longer silently retarget an explicit `--scope user` to the project scope inside a project context (`ase-config.ts`, `usage-tool.md`, `ase-meta-config`, `ase-help-intent`)
- BUGFIX [code]: resolve the project and task scope files against the project root also outside a Git working tree
- BUGFIX [code]: no longer loop forever in the lenient configuration validation if a reported issue path cannot be deleted (`ase-config.ts`)
- BUGFIX [code]: no longer silently erase invalid configuration entries from the target file when writing back a leniently read configuration (`ase-config.ts`)
- BUGFIX [code]: honor backslash-escaped whitespace outside quotes when tokenizing the raw option input
- BUGFIX [code]: add the missing `--prefix`/`-P` option to the synopsis (`ase-arch-analyze`)
- BUGFIX [code]: no longer misclassify an inline code span delimited by a run of 3+ backticks as a fenced code block opener, which inverted the fence state and mangled the content of a subsequent real code block (`ase-markdown.ts`)
- BUGFIX [code]: honor the `ASE_PERSONA_STYLE`, `ASE_GUIDANCE_LEVEL`, and `ASE_PROJECT_BOXING` environment variables again, as the always-present preset values of the built-in `default` scope layer shadowed them (`ase-hook.ts`, `ase-config.ts`)
- BUGFIX [code]: no longer let a non-`ECONNREFUSED` probe error escape the service start flow (`ase-service.ts`)
- REFACTOR [code]: factored the shared task plan hand-over into the `task-next-handoff` definition (`ase-common-task.md`, `ase-task-preflight`, `ase-task-reboot`)
- REFACTOR [code]: moved the artifact blank line and timestamp instructions into the shared meta file (`ase-format-meta.md`, `ase-format-arch.md`, `ase-format-spec.md`)

0.9.56 (2026-08-06)
-------------------

- IMPROVEMENT [code]: normalize legacy task plans into the Markdown frontmatter shape also in `ase-task-edit`, `ase-task-grill`, `ase-task-implement`, `ase-task-preflight`, and `ase-task-reboot`
- IMPROVEMENT [code]: guard against empty or missing arguments and unavailable backends instead of silently proceeding (`ase-meta-brainstorm`, `ase-meta-diaboli`, `ase-meta-search`, `ase-meta-steelman`, `ase-meta-why`, `ase-meta-commit`)
- IMPROVEMENT [code]: made the interaction loop and the dialog handling more robust (`ase-help-intent`)
- IMPROVEMENT [code]: carry a corrective hint on dead-end errors and give final follow-up hints (`ase-task-list`, `ase-sync-reconcile`)
- IMPROVEMENT [code]: support also empty repositories with no `HEAD` and repeat the box title in its footer (`ase-meta-diff`)
- IMPROVEMENT [code]: state the output expectations more precisely (`ase-meta-review`)
- IMPROVEMENT [code]: be more precise on the Kotlin language detection (`ase-arch-discover`)
- IMPROVEMENT [code]: be more clear on the `CANCEL` outcome of a dialog (`ase-dialog.md`)
- IMPROVEMENT [code]: render `-` as fallback for still unavailable usage statistics in the statusline (`ase-statusline.ts`)
- IMPROVEMENT [docs]: made the process handling of the typing demo generator more robust and ensure the Playwright browser is installed (`pages/etc/typing-demo.mjs`, `pages/etc/stx.conf`)
- BUGFIX [code]: validate the `ASE_TOOL` environment variable lazily, so an invalid value no longer breaks unrelated `ase` commands (`ase-setup.ts`)
- BUGFIX [code]: strip the second bar layer from the dialog content rendering (`ase-dialog.md`, `ase-skill.md`)
- BUGFIX [code]: fold commits made after a release into a new section instead of the already released one, and reference the correct command (`ase-meta-changelog`)
- BUGFIX [code]: really consume and use the code hint argument in all steps (`ase-code-insight`)
- BUGFIX [code]: honor the `EXECUTE` result correctly (`ase-help-intent`)
- BUGFIX [code]: fixed the diff handling and allow all used tools (`ase-code-lint`, `ase-docs-proofread`, `ase-meta-commit`)
- BUGFIX [code]: validate the `--mode`/`-m` option before the sneak preview (`ase-meta-quorum`)
- BUGFIX [code]: always create a `Modified:` frontmatter key and do not terminate the fenced code block with payload (`ase-task-preflight`)
- BUGFIX [code]: use the correct order of outputs and declare the internal option (`ase-task-reboot`)
- BUGFIX [code]: do not contradict the documented task plan state transitions (`ase-task-implement`)
- BUGFIX [code]: emit the "updated" template only conditionally (`ase-task-id`)
- BUGFIX [code]: add the three omitted frontmatter keys to the sub-task composition mapping (`ase-task-dissect`)
- BUGFIX [code]: report the word count of the kept instead of the discarded variant (`ase-task-condense`)
- BUGFIX [code]: read back the task plan also after saving it (`ase-sync-export`)
- BUGFIX [code]: do not wrap the already fenced diagram into a second code block (`ase-meta-diff`)
- BUGFIX [code]: normalize also the `OTHER` refinement branch into the minimal form (`ase-docs-proofread`)
- BUGFIX [code]: read back the artifact name, too (`ase-arch-discover`)
- BUGFIX [code]: fixed a wrong step reference, a wrong count, a wrong type, and wrong cross-references (`ase-arch-analyze`, `ase-persona.md`, `ase-constitution.md`, `ase-format-spec.md`)
- BUGFIX [code]: add the missing option to the synopsis (`ase-code-analyze`)
- BUGFIX [code]: state the three-space indentation of the frontmatter correctly (`ase-format-task.md`)
- BUGFIX [docs]: fixed the unhighlighting of search hits and the sticky install bar handling after dismissal (`Modal-Help.astro`, `Progress.astro`, `Sticky-CTA.astro`)
- UPDATE [code, docs, infr]: massive incorporation of proofreading results across all documentation, skills, and website artifacts
- UPDATE [docs]: regenerated the typing demo assets (`pages/public/assets/typing-demo.{gif,mp4}`)
- UPDATE [docs, infr]: upgraded NPM dependencies (`pages/package.json`, `plugin/package.json`, `tool/package.json`)
- CLEANUP [code]: removed an unreachable guard, a dead reference, and redundant conditions (`ase-code-lint`, `ase-format-arch.md`, `ase-common-task.md`)
- CLEANUP [code]: do not contradict other statements (`ase-docs-distill`)
- CLEANUP [code, docs]: cleaned up the statusline namings (`ase-statusline.ts`, `Section-Setup.astro`)
- REFACTOR [code]: factored the shared tenet internalization of `ase-code-craft`, `ase-code-refactor`, and `ase-code-resolve` into `ase-common-code.md`
- REFACTOR [code]: re-use the existing task-related macros and shared descriptions to reduce redundancies (`ase-task-condense`, `ase-task-grill`, `ase-task-reboot`)

0.9.55 (2026-08-03)
-------------------

- FEATURE [code]: converted the `Created:`, `Modified:`, and `Kind:` meta-information of task plans into a Markdown frontmatter block
- FEATURE [code]: moved the task id from the `#   TASK <id>:` heading into an `Id:` frontmatter key
- FEATURE [code]: normalize legacy task plans into the Markdown frontmatter shape on load and rename them via their `Id:` frontmatter key
- FEATURE [code]: added the task plan frontmatter keys `Status:` and `Properties:`
- FEATURE [code]: added `--include`/`-i` and `--exclude`/`-e` options to `ase-task-list` and `ase task list` for filtering the listed task plans
- FEATURE [docs]: documented the task plan lifecycle states and their transitions (`docs/task-states.md`)
- IMPROVEMENT [code]: let `ase_task_load` return the authoring form of a task plan by default and the rendering-prepared form only on demand
- IMPROVEMENT [code]: bounded the unlimited growth of `.ase/service.log` by trimming it to its last 2000 lines whenever the background service is started on a file larger than 1 MB
- IMPROVEMENT [code]: reduced the noise in `.ase/service.log` by capping the logged MCP tool call arguments and by demoting session handshakes, notifications, and stream opens to log level `debug`
- IMPROVEMENT [code]: let the detached background service adopt the log level of its spawning process, making `ase --log-level debug service start` log the full MCP traffic again

0.9.54 (2026-08-03)
-------------------

- IMPROVEMENT [code]: factored the tenet internalization of `ase-code-craft`, `ase-code-refactor`, and `ase-code-resolve` into the new shared `ase-common-code.md`
- FEATURE [code]: added an optional `☯   Kind:` header line to the task plan format, stating the kind of change (`CRAFTING`, `REFACTORING`, `RESOLVING`) and hence the tenet set to honor (`ase-format-task.md`)
- FEATURE [code]: let `ase-task-preflight` and `ase-task-implement` honor the tenet set stated by the task plan, with inference fallback for plans without a `Kind` line
- FEATURE [code]: added a `--worktree`/`-w` option to `ase-task-implement` for applying the change set inside a dedicated Git WorkTree
- FEATURE [docs]: added full-text search box with AND-combined keywords, fuzzy-matching fallback, and highlighted hits to the man-page browser
- FEATURE [docs]: added a blunt "ASE is for you / ASE is not for you" Fit Check panel for fast self-qualification
- FEATURE [docs]: add a methodology provenance strip naming the classic methods baked into the skills and linking each to its manpage
- FEATURE [docs]: added a testimonials pull-quote carousel for named practitioner endorsements
- FEATURE [docs]: added a "Day in the Life" timeline section annotating an engineer's workday with the firing ASE skills (`Section-Day.astro`, `index.astro`)
- FEATURE [docs]: made the skill man-pages deep-linkable via the `#help/<skill-id>` URL fragment, including History API integration, document title sync, and a copy-link button (`Modal-Help.astro`)
- FEATURE [docs]: add a sticky install call-to-action bar to the website
- FEATURE [docs]: added an optional `help` mode to the Terminal component, turning each command row into a `data-help-id` trigger for its skill man-page (`Terminal.astro`)
- IMPROVEMENT [code]: forbid guessing missing tool call parameters, demand verification of dependency APIs against local sources or the web, and require cleanup of scratch files (`ase-constitution.md`)
- IMPROVEMENT [docs]: place commands into tabs in Terminal components for cleaner display (`Terminal.astro`, `Section-Setup.astro`)
- IMPROVEMENT [docs]: render `[...]` placeholders dimmed and with a real ellipsis in Terminal commands (`Terminal.astro`)
- IMPROVEMENT [docs]: mention the author's software development and engineering experience (`Section-Author.astro`)
- IMPROVEMENT [docs]: link the footer copyright author to the internal author section (`Page-Footer.astro`)
- IMPROVEMENT [docs]: polished the header navigation spacing and made the methodology strip buttons stand out (`Page-Header.astro`, `Methodology-Strip.astro`)
- UPDATE [docs]: updated the workflow diagram (`docs/workflow.svg`, `pages/public/assets/workflow.svg`)
- UPDATE [docs, infr]: upgraded NPM dependencies (`pages/package.json`, `tool/package.json`)
- REFACTOR [docs]: bundled the productivity table into the Fit Check panel and dropped the now obsolete highlights section (`Section-Fit.astro`, `Section-Highlights.astro`)

0.9.53 (2026-08-02)
-------------------

- IMPROVEMENT [code]: support the `subtitle` attribute also for the `<ase-tpl-head/>` and `<ase-tpl-foot/>` template patterns (`ase-skill.md`)
- IMPROVEMENT [code]: state the return values of the sub-agents more precisely (`plugin/agents/*.md`)
- IMPROVEMENT [code]: made untracked-file listing, branch deletion, and `~` expansion more robust (`ase-code-dissect`, `ase-meta-workflow`)
- BUGFIX [code]: correctly close the `<ase-tpl-head/>` and `<ase-tpl-foot/>` tags (`ase-common-dissect.md`)
- CLEANUP [code]: fixed a typo and polished wording (`ase-meta-workflow`, `ase-common-dissect.md`)

0.9.52 (2026-08-02)
-------------------

- FEATURE [code]: added `ase-task-dissect` skill for dissecting a task plan into sub-task plans
- FEATURE [code]: added `ase-code-dissect` skill for dissecting a change set into Git WorkTrees
- FEATURE [code]: added `ase-meta-workflow` skill for generating workflow orchestration skills
- FEATURE [code]: added `<agent/>`, `<agent-consolidation/>`, `<skill/>` and `<parallel/>` control constructs (`ase-control.md`)
- FEATURE [code]: added `--prefix`/`-P` option to `ase-code-analyze` and `ase-arch-analyze` for prefixing the reported `P<n>`/`T<n>` finding ids
- IMPROVEMENT [code, infr]: renamed the skill identification construct `<skill>` to `<purpose>` to free the `<skill>` tag for the new invocation construct (`ase-skill.md`, `stx.conf`, all `SKILL.md`)
- IMPROVEMENT [code]: forbid line breaks inside inline code spans when authoring task plans (`ase-format-task.md`)
- IMPROVEMENT [code]: anchor all Git commands at the repository root, name the patch files by part id, and remove them after use (`ase-code-dissect`)
- IMPROVEMENT [code]: tolerate a failing worktree creation and omit an empty `VERIFICATION` section in a part (`ase-code-dissect`, `ase-task-dissect`)
- BUGFIX [code]: fixed badly broken lines in reused task plans by returning the rendering-prepared content from `ase_task_save` (`ase-task.ts`, `ase-common-task.md`, `ase-task-edit`, `ase-task-grill`)
- BUGFIX [code]: match the `**WHAT**`/`**WHY**` bullet points independent of their rendering-prepared bullet marker (`ase-task-reboot`)
- BUGFIX [code]: normalize the rendering-prepared `◯` bullet markers, split inline code spans back into their authoring form, and align the re-wrap width with the ~100-character plan convention (`ase-task-condense`)
- UPDATE [docs, infr]: upgraded NPM dependencies (`pages/package.json`, `plugin/package.json`, `tool/package.json`)
- CLEANUP [infr]: excluded the generated `docs` SVG files from the project statistics (`etc/stx.conf`)

0.9.51 (2026-07-26)
-------------------

- FEATURE [code]: added `ase-meta-quotes` skill for finding quotes for topic keywords
- FEATURE [code]: split `ase-meta-proximity` skill into a skill and a reusable agent
- FEATURE [code]: added `--include`/`-i` and `--exclude`/`-e` options to `ase-code-lint` for narrowing the checked code quality aspects
- IMPROVEMENT [code]: report findings in descending order `HIGH`, `MEDIUM`, `LOW`, `ACCEPTED` in skills with a `--severity`/`-S` option
- IMPROVEMENT [code]: gate redundancy findings on a 2:1 payoff ratio to avoid mere code relocation (`ase-code-lint.md`)
- IMPROVEMENT [code]: strengthen typing in the tool approval decision (`ase-hook.ts`)
- BUGFIX [code]: show the reasoning effort in the statusline also under GitHub Copilot CLI
- CLEANUP [code]: simplify the plugin root lookup, banner assembly, and blank lines (`ase-hook.ts`)

0.9.50 (2026-07-26)
-------------------

- FEATURE [docs]: render all external links with an attached "↗" arrow symbol and open them in a new tab (`External-Links.astro`, `theme.css`, `BaseLayout.astro`)
- IMPROVEMENT [docs]: mark the matrix cells with "X" in the operation modes diagram (`docs/operation-modes.svg`, `docs/operation-modes.xlsx`, `pages/public/assets/operation-modes.svg`)
- IMPROVEMENT [code]: request concise prose sentences for the `journalist` persona details (`ase-persona.md`)
- UPDATE [docs]: fix typos and add a legend in the workflow diagram (`docs/workflow.svg`, `docs/workflow.graffle`, `pages/public/assets/workflow.svg`)
- UPDATE [infr]: upgrade NPM dependencies (`plugin/package.json`, `tool/package.json`)
- CLEANUP [code]: size-optimize the constitution by dropping the Copilot session banner and hint templates (`ase-constitution.md`, `ase-persona.md`)
- CLEANUP [docs]: polish wording and markup across the website sections (`Section-Author.astro`, `Section-Compat.astro`, `Section-Workflows.astro`)

0.9.49 (2026-07-26)
-------------------

- FEATURE [code]: added `agent.guidance` config parameter with levels `none`, `minimal`, `normal` (default) and `verbose`
- FEATURE [code]: added `ase-meta-config` skill mirroring the non-interactive `ase config` subcommands
- FEATURE [code]: added `ase_config_list` MCP tool listing all effective config entries with their scope (`ase-config.ts`)
- FEATURE [code]: added `--padding`/`-p` option (default `0`) padding the statusline lines with N spaces on each side (`ase-statusline.ts`, `ase-setup.ts`)
- FEATURE [code]: honor `agent.guidance` in the skills through a new `Guidance Hint Level` section and a new `<ase-tpl-hint level="..."/>` template pattern (`ase-skill.md`)
- FEATURE [code]: added guidance-gated closing hints to `ase-code-lint`, `ase-docs-proofread`, `ase-meta-review`, `ase-meta-diff`, `ase-meta-commit`, `ase-meta-brainstorm`, `ase-arch-discover`, `ase-sync-import`, `ase-sync-export`, `ase-task-list`, and `ase-task-view`, and to the option-parsing and task-argument error paths (`ase-getopt.md`, `ase-common-task.md`)
- IMPROVEMENT [code]: gate the skill identification chrome and the parsed-options line on the higher guidance levels (`ase-skill.md`, `ase-getopt.md`)
- IMPROVEMENT [code]: append `--tool` option to generated statusline command in setup (`ase-setup.ts`)
- BUGFIX [code]: emitted the model-side session banner for GitHub Copilot CLI instead of OpenAI Codex CLI, as only the latter supports the hook `systemMessage` field (`ase-constitution.md`)
- UPDATE [docs]: refreshed the workflow diagram (`docs/workflow.svg`, `pages/public/assets/workflow.svg`)
- CLEANUP [code]: removed `ase-meta-persona` skill and `ase_persona` tool, as both are subsumed by `ase-meta-config` and `agent.persona` config key

0.9.48 (2026-07-25)
-------------------

- IMPROVEMENT [code]: probe live-context fields for a portable and correct context window in statusline `%C` (`ase-statusline.ts`)
- IMPROVEMENT [code]: cache the task storage specification to avoid re-parsing the layered config chain (`ase-task.ts`)
- IMPROVEMENT [code]: cache the `git rev-parse --show-toplevel` project root lookup (`ase-config.ts`)
- IMPROVEMENT [code]: make service probing robust against connection errors (`ase-mcp.ts`, `ase-service.ts`)
- IMPROVEMENT [code]: reject configured basedirs with parent traversal segments (`ase-artifact.ts`, `ase-config.ts`)
- IMPROVEMENT [code]: hoist invariant computations out of the option iterations (`ase-getopt.ts`)
- IMPROVEMENT [code]: render the skill command proposal more compactly (`ase-help-intent/SKILL.md`)
- BUGFIX [code]: honor `process.exitCode` on graceful termination (`ase.ts`)
- BUGFIX [code]: shell-quote Commander-parsed arguments when reassembling them (`ase-getopt.ts`)
- BUGFIX [code]: support SSH and scp-style GitHub repository URLs when fetching stars (`ase-skills.ts`)
- BUGFIX [code]: clone also the return value of the KV get operation (`ase-kv.ts`)
- BUGFIX [code]: catch errors on the log file append operation (`ase-hook.ts`)
- BUGFIX [code]: use a regular exception handler in `main` for process termination (`ase-statusline.ts`)
- REFACTOR [code]: move stdin/stdout handling into a common `ase-stdio.ts` module (`tool/src/*.ts`)
- CLEANUP [code]: remove redundancies and simplify code across the `ase` CLI sources (`tool/src/*.ts`)

0.9.47 (2026-07-25)
-------------------

- FEATURE [code]: add `ase-help-skill` skill showing the manual page of an ASE skill by (abbreviated) name or fuzzy purpose
- IMPROVEMENT [code]: rename skill `ase-meta-intent` to `ase-help-intent` to align it with the `ase-help-xxx` skill family
- IMPROVEMENT [code]: ship a hand-sorted skill catalog instead of generating it (`ase-help-skill/catalog.md`)
- IMPROVEMENT [code]: delete still-open tasks when a skill exits early (`ase-skill.md`)
- IMPROVEMENT [code]: keep a non-empty legacy per-task directory and warn instead of removing it (`ase-task.ts`)
- IMPROVEMENT [code]: ensure the task base directory cannot escape the project root (`ase-task.ts`)
- IMPROVEMENT [code]: harden hook payload validation against raw objects (`ase-hook.ts`)
- IMPROVEMENT [code]: speed up paragraph checking in Markdown preparation (`ase-markdown.ts`)
- IMPROVEMENT [code]: strengthen typing in the persona command (`ase-persona.ts`)
- IMPROVEMENT [docs]: list the `ase-help-*` family in the website Design section (`Section-Design.astro`)
- IMPROVEMENT [docs]: sort the help skills to the top of the skill group (`skills.ts`)
- BUGFIX [code]: buffer MCP messages arriving during an HTTP reconnect instead of discarding them (`ase-mcp.ts`)
- BUGFIX [code]: close the log stream and flush pending writes on termination (`ase-log.ts`, `ase.ts`)
- BUGFIX [code]: render the harness name instead of a hard-coded `claude` in statusline `%V` (`ase-statusline.ts`)
- BUGFIX [code]: add the missing user scope to the config default scope chain (`ase-config.ts`)
- BUGFIX [code]: avoid truncated stdout writes (`ase-compat.ts`, `ase-config.ts`)
- BUGFIX [code]: avoid line breaks within backtick spans in skill help pages (`help.md`)
- UPDATE [docs]: mark Anthropic Claude Opus 5 as fully supported (`Section-Compat.astro`)
- UPDATE [docs]: update the workflow diagram (`workflow.svg`, `workflow.graffle`, `workflow.pdf`)
- UPDATE [docs]: upgrade NPM dependencies (`pages/package.json`)
- CLEANUP [code]: remove redundancies and simplify code across the `ase` CLI sources (`tool/src/*.ts`)
- CLEANUP [code]: memoize repeated lookups in the statusline command (`ase-statusline.ts`)

0.9.46 (2026-07-25)
-------------------

- FEATURE [code]: add `ase-meta-intent` skill routing a free-text intent to a generated `/ase-xxx-xxx` command
- FEATURE [code]: add `ase-meta-proximity` skill determining a topic's parent/sibling/child proximity, optionally grounded and navigable
- FEATURE [code]: add `ase-meta-eli5` skill explaining topics "like I'm 5", optionally Web-grounded
- IMPROVEMENT [code]: allow `ase-code-{craft,refactor,resolve}` to accept `--next GRILL` (`SKILL.md`)
- IMPROVEMENT [code]: warn when Web grounding yields no facts in `ase-meta-proximity` (`SKILL.md`)
- IMPROVEMENT [code]: allow 2 to 9 answer lines in custom dialogs (`ase-dialog.md`)
- IMPROVEMENT [docs]: update workflow diagram for latest skill additions (`workflow.svg`)
- IMPROVEMENT [infr]: use `execa` for another install step (`etc/stx.conf`)
- UPDATE [infr]: upgrade NPM dependencies (`pages/package.json`, `tool/package.json`)

0.9.45 (2026-07-21)
-------------------

- FEATURE [code]: support querying foreign AIs via an MCP-to-agent-harness bridge (`ase-setup.ts`, `ase-meta-chat.md`)
- FEATURE [code]: add grounding commandment favoring evidence and references over model knowledge (`ase-constitution.md`)
- IMPROVEMENT [code]: force smaller unified diffs in `ase-code-lint` and `ase-docs-proofread` (`SKILL.md`, agents)
- IMPROVEMENT [code]: number the findings in `ase-code-lint` and `ase-docs-proofread` (`SKILL.md`)
- IMPROVEMENT [code]: treat `TASK` differently and refine `ase-sync-import` handling (`SKILL.md`)
- IMPROVEMENT [code]: improve `ase-meta-quorum` description and add missing `TaskUpdate` tool (`SKILL.md`)
- IMPROVEMENT [code]: support more cases and be more precise in `ase-meta-changelog` (`SKILL.md`)
- IMPROVEMENT [docs]: update website compat matrix to GPT 5.6 and tighten table spacing (`Section-Compat.astro`)
- IMPROVEMENT [docs]: mark Fable as fully supported and in primary focus (`Section-Compat.astro`)
- BUGFIX [code]: fix grammar, wording, references, and placeholders across skills and meta files
- REFACTOR [code]: reduce redundancies in the task skills via a shared `ase-common-task.md` (`SKILL.md`)
- REFACTOR [code]: reduce redundancy via a macro definition in task skills (`ase-task-*/SKILL.md`)
- CLEANUP [code]: align skill structure, style, and references to repo-wide convention
- CLEANUP [code]: remove stray non-portable `model` frontmatter lines (`ase-meta-search.md`, `ase-arch-analyze/SKILL.md`)

0.9.44 (2026-07-20)
-------------------

- IMPROVEMENT [code]: harden Bash command approval with stricter validation in hook processing (`ase-hook.ts`)
- IMPROVEMENT [code]: support `/xxx`-anchored `.gitignore` patterns and reject `..` filenames (`ase-artifact.ts`)
- IMPROVEMENT [code]: validate sessions in task MCP tools and cache `projectRoot` results (`ase-task.ts`)
- IMPROVEMENT [code]: normalize error outputs by dropping tool prefixes (`ase-config.ts`, `ase-kv.ts`, `ase-persona.ts`)
- IMPROVEMENT [code]: harden error handling in setup, service, log, diagram, and meta commands (`ase-*.ts`)
- IMPROVEMENT [code]: mask more key information and encode the Exa API key in the URL (`ase-setup.ts`)
- IMPROVEMENT [code]: honor grey boxing in `ase-code-lint` and add `-h`/`--help` to `ase-meta-compat` (`SKILL.md`)
- IMPROVEMENT [code]: refine wording and precision across plugin skills, agents, and meta files
- IMPROVEMENT [docs]: improve website diagram zoom handling and external links (`Modal-Image.astro`, `Section-Author.astro`)
- IMPROVEMENT [docs]: support `.js.map` files in the website build (`astro.config.mjs`)
- IMPROVEMENT [infr]: allow more install scripts and run `allowScripts` locally via `execa` (`etc/stx.conf`, `package.json`)
- BUGFIX [code]: fix Markdown span rendering: unclosed backticks, paragraph crossing, span close (`ase-markdown.ts`)
- BUGFIX [code]: handle multi-byte UTF-8 sequences spanning chunk boundaries (`ase-service.ts`)
- BUGFIX [code]: fix service restarts under a changed project id (`ase-mcp.ts`)
- BUGFIX [code]: clamp statusline metric and fix skill scoring edge cases (`ase-statusline.ts`, `ase-skills.ts`)
- BUGFIX [code]: fix log stream error handling and stderr TTY detection (`ase-log.ts`)
- BUGFIX [code]: align `ase config get` locking behavior with its MCP tool counterpart (`ase-config.ts`)
- BUGFIX [code]: fix references, placeholders, grammar, and wording across skills and meta files
- BUGFIX [docs]: fix clipboard copying, DOM id uniqueness, invalid classes, and typos on the website
- BUGFIX [infr]: fix `pages` dependency pinning via a `typopro-web` override (`pages/package.json`)
- UPDATE [infr]: upgrade NPM dependencies across all workspaces (`package.json`)
- CLEANUP [code]: remove redundancies and simplify code across the `ase` CLI sources (`tool/src/*.ts`)
- CLEANUP [code]: cleanup formatting, alignment, comments, and stray blank lines across sources
- CLEANUP [docs]: cleanup and simplify website components (`pages/src/**`)
- CLEANUP [infr]: align repository URLs in all `package.json` files and drop unused ESLint code
- REFACTOR [code]: split Markdown preparation into one function per pass (`ase-markdown.ts`)
- REFACTOR [code]: merge nearly identical functions and use lookup tables (`ase-task.ts`, `ase-setup.ts`)
- REFACTOR [docs]: replace conditional website header logic with a lookup data structure (`Page-Header.astro`)

0.9.43 (2026-07-09)
-------------------

- CLEANUP [infr]: upgrade dependencies to eliminate `es5-ext` transitively

0.9.42 (2026-07-09)
-------------------

- CLEANUP [infr]: disable `es5-ext` install scripts also at top-level

0.9.41 (2026-07-09)
-------------------

- UPDATE [infr]: upgrade NPM dependencies and add missing `json-asty` dependency (`package.json`)
- CLEANUP [infr]: disable `es5-ext` install scripts (`package.json`)

0.9.40 (2026-07-06)
-------------------

- IMPROVEMENT [docs]: improve website Setup section rendering and right-side placement (`Section-Setup.astro`)
- IMPROVEMENT [docs]: add more scroll-reveal content animations across website sections (`Section-*.astro`, `Video-Row.astro`)
- IMPROVEMENT [docs]: refine Highlights comparison table for mobile readability, positioning, and richer markup (`Section-Highlights.astro`, `comparison.ts`)
- IMPROVEMENT [docs]: credit further feedback contributors in website Author section (`Section-Author.astro`)
- BUGFIX [docs]: fix HTML element indentation, section glows, and a typo across website sections (`Section-*.astro`)
- CLEANUP [docs]: clean up Highlights comparison table markup (`Section-Highlights.astro`, `comparison.ts`)
- CLEANUP [infr]: drop unneeded top-level `json-asty` dependency (`package.json`)

0.9.39 (2026-07-05)
-------------------

- FEATURE [docs]: add old-school/AI-native/AI-advanced comparison table to website Highlights section (`Section-Highlights.astro`, `comparison.ts`)
- FEATURE [docs]: add license reference to README (`README.md`)
- IMPROVEMENT [docs]: refine Hero attention drawing and dim coloring (`Hero.astro`)
- IMPROVEMENT [docs]: improve website Setup section rendering (`Section-Setup.astro`)
- IMPROVEMENT [docs]: refine README line breaks and image ordering (`README.md`)
- UPDATE [docs]: update banner image (`docs/ase-banner.png`)

0.9.38 (2026-07-05)
-------------------

- FEATURE [code, docs, infr]: add `ase setup statusline activate|deactivate` commands (`ase-setup.ts`, `Section-Setup.astro`, `package.json`)
- BUGFIX [code]: harden custom-dialog rendering against wrong glyph/padding output (`ase-dialog.md`, `ase-skill.md`)

0.9.37 (2026-07-04)
-------------------

- FEATURE [code]: wire the `project.boxing` transparency classification (`white`/`grey`/`black`) into artifact-touching skills
- FEATURE [code]: add `[<artifact-kind>]` tag support to the `ase-meta-changelog` skill (`SKILL.md`, `help.md`)
- IMPROVEMENT [code, docs]: surface `project.boxing` in configuration docs and export it into the session environment and status line (`docs/configuration.md`, `ase-hook.ts`, `ase-constitution.md`)
- IMPROVEMENT [docs]: credit the author as renowned in the website Hero section (`Hero.astro`)
- CLEANUP [docs]: reduce Hero top spacing by dropping the `mt-1` margin (`Hero.astro`)

0.9.36 (2026-07-04)
-------------------

- IMPROVEMENT [code]: add tiered staleness (`--staleness`) and small-scope (`--small-scope`) dependency-weight penalties to `ase-arch-discover`
- UPDATE [infr]: upgrade GitHub Action `actions/setup-node` from v4 to v5 (`static.yml`)
- UPDATE [docs]: sync tool and plugin reference documentation with current implementation (`docs/usage-plugin.md`, `docs/usage-tool.md`)

0.9.35 (2026-07-04)
-------------------

- FEATURE [docs]: document `--scope` option in website Setup section (`Section-Setup.astro`, `Terminal.astro`)
- IMPROVEMENT [code]: fan out Agent spawning with parallelism across skills to gain performance (`ase-code-analyze.md`, `ase-code-lint`, `ase-docs-proofread`, `ase-meta-quorum`, `ase-meta-search`)
- IMPROVEMENT [code]: drop explicit `--scope user` since it is the default (`ase-setup.ts`)
- IMPROVEMENT [docs]: refine compatibility statements for Sonnet and Fable (`Section-Compat.astro`)
- IMPROVEMENT [docs]: credit feedback contributors in website Author section (`Section-Author.astro`)
- BUGFIX [code]: fix Agent response handling and give tasks unique names across skills (`ase-*/SKILL.md`)
- BUGFIX [code]: fix "in flight" calculations on service socket close (`ase-service.ts`)
- BUGFIX [code, docs]: fix proofread results across website copy, docs, and skills (website, `README.md`, skills)
- UPDATE [infr]: upgrade NPM dependencies across all workspaces (`package.json`, `pages/package.json`, `plugin/package.json`, `tool/package.json`)
- CLEANUP [infr]: reduce `AGENTS.md` repository-layout section verbosity (`AGENTS.md`)
- CLEANUP [code]: remove unused user-dialog meta to stop the LLM from triggering it (`ase-dialog.md`)

0.9.34 (2026-07-02)
-------------------

- FEATURE: add `-s, --scope <user|project|local>` option to `ase setup install/update/uninstall/enable/disable` and `ase setup mcp activate/deactivate`
- FEATURE: add YouTube video embed and QR-code modal to the website (`Hero-Video.astro`, `Modal-YouTube.astro`, `Modal-QR.astro`, `QR-Code.astro`, `Page-Footer.astro`)
- FEATURE: add Anthropic Claude Sonnet 5 to the website compatibility matrix (`Section-Compat.astro`)
- IMPROVEMENT: justify body text blocks across website sections with hyphenation support (`theme.css`, `Hero.astro`, `Section-*.astro`)
- IMPROVEMENT: refine Hero rendering and layout once more (`Hero.astro`)
- IMPROVEMENT: update agentic-levels diagram with new additional dimensions (`agentic-levels.svg`, `Section-Usage.astro`)
- IMPROVEMENT: fixate width of hamburger menu icon (`Page-Header.astro`)

0.9.33 (2026-06-29)
-------------------

- FEATURE: add internal typing-demo page for rendering a banner (`typing-demo.astro`, `typing-demo.mjs`)
- IMPROVEMENT: use consistent "Anthropic Claude Code CLI" naming across docs, website, and tool (`README.md`, `AGENTS.md`, website, tool)
- IMPROVEMENT: refine Hero rendering, text, height, and spacing (`Hero.astro`, `Typing-Demo.astro`, `Section-Design.astro`, `Section-Setup.astro`)
- IMPROVEMENT: add count option to render just the top-N commands in typing demo (`Typing-Demo.astro`)
- IMPROVEMENT: add star-this-project animation and script to Hero (`Hero.astro`, `gh-star.gif`, `gh-star.sh`)
- IMPROVEMENT: be more precise about compatibility in website Compat section (`Section-Compat.astro`)
- IMPROVEMENT: add zoom button to website diagrams (`Diagram.astro`, `Video-Embed.astro`)
- IMPROVEMENT: provide local Playr SVG icon and re-add video speed control (`Modal-Video.astro`, `astro.config.mjs`)
- IMPROVEMENT: add project links and feedback credits to Author/Footer sections (`Section-Author.astro`, `Page-Footer.astro`)
- IMPROVEMENT: use signet in front of author name (`Section-Author.astro`)
- IMPROVEMENT: step down to single-column grids on small viewports (`Section-Author.astro`)
- IMPROVEMENT: emit a `robots.txt` file (`astro.config.mjs`)
- IMPROVEMENT: reduce font scope to shrink generated site size (`theme.css`)
- IMPROVEMENT: update banner image (`docs/ase-banner.png`)
- UPDATE: upgrade dependencies (`package.json`)
- CLEANUP: make ASE constitution not Claude-Code-CLI-specific (`ase-constitution.md`)
- CLEANUP: clean up Usage and Author website components (`Section-Usage.astro`, `Section-Author.astro`)
- CLEANUP: remove obsolete import (`Page-Footer.astro`)

0.9.32 (2026-06-28)
-------------------

- FEATURE: add `ase meta <file>` command to load ASE meta files from user skills (`ase-meta.ts`, `ase.ts`)
- FEATURE: place demo `hello` skill under version control (`.claude/skills/hello/`)
- IMPROVEMENT: add stdout writing helper to avoid output truncations (`ase-stdout.ts`, `ase-artifact.ts`, `ase-hook.ts`, `ase-task.ts`)
- IMPROVEMENT: auto-approve Read operations targeting files under the plugin root (`ase-hook.ts`)

0.9.31 (2026-06-28)
-------------------

- IMPROVEMENT: add annotations across website sections with flat variant (`Annotation.astro`, `Section-*.astro`)
- IMPROVEMENT: further improve mobile/responsive rendering and header spacing of website (`Hero.astro`, `Page-Header.astro`, `Section-Compat.astro`, `Typing-Demo.astro`)
- IMPROVEMENT: close hamburger menu and clear URL on outside click/top (`Page-Header.astro`, `Progress.astro`)
- IMPROVEMENT: add project links to website Author section (`Section-Author.astro`)
- IMPROVEMENT: improve coloring of agentic-levels diagram (`docs/`, `pages/public/assets/`)
- IMPROVEMENT: align Typing-Demo prompt with other terminals (`Typing-Demo.astro`)
- CLEANUP: fix wording and proofread findings across website sections (`Section-*.astro`)
- CLEANUP: ignore more macOS and temporary files (`.gitignore`)

0.9.30 (2026-06-27)
-------------------

- IMPROVEMENT: extend, reorder, and add brainstorming to website highlights (`highlights.ts`)
- IMPROVEMENT: import more README content into website Usage section (`Section-Usage.astro`)
- IMPROVEMENT: mention role-experience assumption in website Design section (`Section-Design.astro`)
- IMPROVEMENT: make Hero quote even more friendly (`Hero.astro`)
- BUGFIX: fix grammar problems (`README.md`)
- BUGFIX: remove trailing dot in persona pyramid-format examples (`ase-persona.md`)
- UPDATE: switch distribution license from GPL-3.0 to Apache-2.0 (`LICENSE.txt`, file headers)
- CLEANUP: remove README content already present on the website (`README.md`)

0.9.29 (2026-06-27)
-------------------

- FEATURE: add fifth `journalist` persona and reimplement all persona styles (`ase-persona.md`, `ase-meta-persona`, `ase-persona.ts`, `ase-config.ts`)
- IMPROVEMENT: integrate `pages/` workspace into top-level build orchestration (`etc/stx.conf`)
- UPDATE: re-render workflow and agentic-levels diagrams (`docs/`, `pages/public/assets/`)
- CLEANUP: cleanup skill manpages (`help.md` files)
- CLEANUP: cleanup website author component (`Section-Author.astro`)

0.9.28 (2026-06-26)
-------------------

- FEATURE: add fifth `journalist` persona with pyramid-structured title/core/detail bullets (`ase-persona.md`, `ase-meta-persona`, `ase-persona.ts`, `ase-config.ts`)
- IMPROVEMENT: refine persona rules and default invalid persona to engineer (`ase-persona.md`)
- IMPROVEMENT: add fade-in/out stargazer scripting-hint annotation and swipe through multiple quotes on Hero (`Annotation.astro`, `Hero.astro`, `package.json`)
- IMPROVEMENT: darken modal background (`Modal.astro`)
- IMPROVEMENT: document `pages/` area in repository layout (`AGENTS.md`)
- BUGFIX: fix rendering under latest Astro compiler trimming newlines (website components)
- UPDATE: switch website to TypoPRO fonts only (`package.json`, `theme.css`)
- UPDATE: upgrade tool dependencies (`tool/package.json`)
- CLEANUP: ignore Playwright temporary directory (`pages/.gitignore`)

0.9.27 (2026-06-26)
-------------------

- IMPROVEMENT: add Design Assumptions section and reorder highlights on website (`Section-Design.astro`, `highlights.ts`)
- IMPROVEMENT: render skill manpages as HTML help modal instead of GitHub links (`Modal-Help.astro`, `Section-Usage.astro`, `skills.ts`)
- IMPROVEMENT: improve Copilot dialog result mapping, no-key case, and start-over precision (`ase-dialog.md`)
- IMPROVEMENT: align box drawing and be more precise (`ase-skill.md`)
- IMPROVEMENT: provide default for invalid persona (`ase-persona.md`)
- IMPROVEMENT: complete the kinds of artifacts (`ase-format-meta.md`)
- BUGFIX: fix ERROR result falling through to label-mapping in all dialog branches (`ase-dialog.md`)
- BUGFIX: explicitly define `<break/>` control construct (`ase-control.md`)
- BUGFIX: omit empty relations in export and fix cross-references (`ase-format-spec.md`)
- BUGFIX: fix name reference (`ase-tenets.md`)
- CLEANUP: cleanup persona wording (`ase-persona.md`)
- CLEANUP: define placeholders before use (`ase-format-meta.md`)

0.9.26 (2026-06-24)
-------------------

- FEATURE: add deterministic session-start banner via `systemMessage` (`ase-hook.ts`, `ase-constitution.md`)
- IMPROVEMENT: build out website Workflows section and apply terminal-styled boxes (`pages/` Astro components)
- IMPROVEMENT: rewrite Persona ruleset without control structures and force re-evaluation of persona rules (`ase-persona.md`, `ase-meta-persona` skill)
- IMPROVEMENT: report when the persona did not change (`ase-meta-persona` skill)
- IMPROVEMENT: load tenets on-demand from skills again to shrink the constitution (`ase-constitution.md`, `ase-tenets.md`, 5 `SKILL.md` files)
- BUGFIX: fix waves rendering on Safari and improve Terminal/Hero/Author rendering (`pages/` Astro components)
- BUGFIX: fix typo in author name (`Section-Author.astro`)
- CLEANUP: reduce constitution size and avoid persona-conflicting style hints (`ase-constitution.md`)
- CLEANUP: polish website texts, wording, and English (`pages/` Astro components)

0.9.25 (2026-06-23)
-------------------

- IMPROVEMENT: polish website styling and extend website content (again)

0.9.24 (2026-06-22)
-------------------

- IMPROVEMENT: polish website styling and extend website content

0.9.23 (2026-06-22)
-------------------

- FEATURE: first cut for a real ase.tools website based on Astro framework

0.9.22 (2026-06-20)
-------------------

- FEATURE: add `ase-sync-export` skill to export artifact content into side-by-side files (`ase-sync-export` skill)
- FEATURE: add per-artifact `Export:` rules and side-by-side export convention (`ase-format-meta.md`, `ase-format-spec.md`, `ase-format-arch.md`)
- FEATURE: add SVG output format to the diagram facility via `beautiful-mermaid` (`ase-diagram.ts`)
- IMPROVEMENT: enforce custom-dialog definition over built-in dialog tool across skills (13 `SKILL.md` files)
- UPDATE: register the new `ase-sync-export` skill and refresh the skill count from 38 to 39 (`AGENTS.md`, `README.md`)
- CLEANUP: clean up workflow diagram (`docs/workflow.*`)
- REFACTOR: reorder Technology Stack component fields alphabetically (`ase-format-arch.md`)

0.9.21 (2026-06-19)
-------------------

- FEATURE: add Technology Stack (TS) artifact to Architecture format (`ase-format-arch.md`)
- FEATURE: add Sync Mode to the operation-modes overview (`README.md`)
- IMPROVEMENT: add more USP entries for sync/implement/resolve/refactor/analyze skills (`README.md`)
- IMPROVEMENT: refine Funnel Mode and Sync Mode operation-mode wording (`README.md`)
- BUGFIX: do not hard-code the artifact base directory (`ase-format-arch.md`, `ase-format-spec.md`)
- BUGFIX: fix skill count from 37 to 38 (`README.md`)
- UPDATE: refresh building-blocks and workflow diagrams (Graffle/SVG/PDF)

0.9.20 (2026-06-18)
-------------------

- FEATURE: add `ase-sync-import` skill to import foreign sources into target artifact kinds (`ase-sync-import` skill)
- IMPROVEMENT: use options for source/target with bidirectional sync, and improve examples and cross-references (`ase-sync-reconcile` skill)
- UPDATE: update operation-modes matrix and diagram (`docs/operation-modes.*`)
- UPDATE: update documentation from latest code status quo (`AGENTS.md`)

0.9.19 (2026-06-18)
-------------------

- UPDATE: reconcile user documentation with current code status quo (`README.md`, `docs/configuration.md`, `docs/usage-plugin.md`, `docs/usage-tool.md`)
- REFACTOR: rename `ase-meta-update` skill to `ase-sync-reconcile` (`ase-sync-reconcile` skill)

0.9.18 (2026-06-17)
-------------------

- IMPROVEMENT: give the `ase-meta-update` skill more power (`ase-meta-update` skill)
- REFACTOR: factor out reusable tenets into own `meta/ase-tenets.md` file (`ase-tenets.md`, `ase-constitution.md`)
- UPDATE: upgrade NPM dependencies

0.9.17 (2026-06-15)
-------------------

- FEATURE: add `ase-meta-update` skill to update target artifact kinds from source artifact kinds (`ase-meta-update` skill)

0.9.16 (2026-06-15)
-------------------

- BUGFIX: revert MCP bridge startup change that broke the service (`ase-mcp.ts`)

0.9.15 (2026-06-15)
-------------------

- IMPROVEMENT: be more precise when checking Created and updating Modified time (`ase-task-condense`, `ase-task-edit`, `ase-task-grill`, `ase-task-preflight`, `ase-task-reboot` skills)
- IMPROVEMENT: use new prefix parameter to clear only relevant KV keys, and extend the analysis lists for additional indicators (`ase-code-analyze` skill)
- BUGFIX: avoid MCP bridge crash before reconnect machinery exists (`ase-mcp.ts`)
- UPDATE: extend agentic-levels diagram with knowledge and skill dimensions (`docs/agentic-levels.*`)
- UPDATE: update documentation from latest code status quo (`AGENTS.md`, `README.md`, `docs/usage-tool.md`)

0.9.14 (2026-06-15)
-------------------

- IMPROVEMENT: be even more defensive when rebooting the task plan in `ase-task-reboot` skill
- IMPROVEMENT: be even more defensive in `ase-task-id` skill
- IMPROVEMENT: try harder to avoid stale Edit-auto-approve markers (`ase-code-lint`, `ase-docs-proofread` skills)
- IMPROVEMENT: be more precise on argument parsing inside `ase-meta-chat` agent
- IMPROVEMENT: be more precise in `ase-getopt.md`
- BUGFIX: introduce KV namespace prefix so analyze skills no longer wipe the shared per-project KV store and clear stale issues when all problems are dropped (`ase-arch-analyze`, `ase-code-analyze` skills, `ase-kv.ts`)
- BUGFIX: correctly produce diff hunks for multi-line changes (`ase-code-lint`, `ase-docs-proofread` skills)
- BUGFIX: make evaluation calculation more robust in `ase-meta-evaluate` skill
- BUGFIX: avoid self-contradictory size-2-cluster focal-aspect rule in `ase-arch-analyze` skill
- BUGFIX: make `--limit` implementation more correct in `ase-arch-discover` skill
- BUGFIX: unambiguously handle CANCEL situation in `ase-meta-brainstorm` skill
- BUGFIX: clamp bar/pad lengths to zero (`ase-skill.md`)
- CLEANUP: remove dead OTHER-response branches in custom-dialog/`--no-other` skills (`ase-task-condense`, `ase-task-grill`, `ase-task-implement`, `ase-task-preflight`, `ase-task-reboot`)

0.9.13 (2026-06-15)
-------------------

- IMPROVEMENT: speed up processing via batch KV operation in `ase-arch-analyze` skill
- IMPROVEMENT: make conditions more robust and fail-safe for edge cases (`ase-code-resolve`, `ase-code-insight`, `ase-task-grill`, `ase-task-implement`, `ase-task-preflight`, `ase-task-edit`)
- IMPROVEMENT: reset the task plan less easily via a regexp match in `ase-task-edit` skill
- IMPROVEMENT: extract created timestamp so it can be inserted later correctly in `ase-task-condense` skill
- IMPROVEMENT: be more precise in the materialization of the alternatives in `ase-meta-evaluate` skill
- IMPROVEMENT: make bar-length calculation identical for head/foot and boxed, and clarify step-id-to-task-id mapping (`ase-skill.md`)
- IMPROVEMENT: define the number of consensus in `ase-meta-quorum` skill
- IMPROVEMENT: make mitigation optional in the table of `ase-meta-diff` skill
- IMPROVEMENT: directly handle DONE as next step instead of forwarding to `ase-task-edit` (`ase-code-{craft,refactor,resolve}` skills)
- IMPROVEMENT: make `triggerReconnect` idempotent (`ase-mcp.ts`)
- IMPROVEMENT: honor an explicit `ASE_TERM_COLORS=none` even when running on a TTY (`ase-diagram.ts`)
- BUGFIX: fix "npm start publish" procedure for Codex
- BUGFIX: fix branch ordering that defeated the all-negative warning in `ase-meta-evaluate` skill
- BUGFIX: change task id only if the MCP call succeeded in `ase-task-id` skill
- BUGFIX: detect special case where old and new task ids are equal in `ase-task-rename` skill
- BUGFIX: quote `args` to avoid empty-expansion breakage in `ase-task-implement` skill
- BUGFIX: define placeholders before using them (`ase-code-lint`, `ase-docs-proofread` skills)
- BUGFIX: fix XML tags and tag syntax (`ase-skill.md`, `ase-getopt.md`)
- BUGFIX: roll `formatTokens` thousands tier over into the next unit (`ase-statusline.ts`)
- BUGFIX: use floored percentage as divisor for `%C` token limit (`ase-statusline.ts`)
- BUGFIX: whitelist `Persona.get` value against known styles (`ase-persona.ts`)
- BUGFIX: fix getopt list-of-choices validation for hyphenated long options (`ase-getopt.ts`)
- UPDATE: update wording in workflow diagram (`docs/workflow.*`)
- CLEANUP: clarify superseding, mismatch, uniqueness, and use-case references in artifact-set formats (`ase-format-arch.md`, `ase-format-spec.md`, `ase-format-meta.md`)
- CLEANUP: remove unused tool declaration (`ase-code-explain`, `ase-code-insight` skills)
- CLEANUP: cleanup control structure in `ase-task-grill` skill
- CLEANUP: cleanup decision matrix calculations (`ase-skills.ts`)
- CLEANUP: use same default as in option (`ase.ts`)
- CLEANUP: remove stray step-end tags and final cleanups in `ase-meta-compat` skill, adjust symbol (`ase-compat.ts`)
- CLEANUP: be more precise in wording (`ase-dialog.md`)
- CLEANUP: also commit the Codex `plugin.json` and resolve related conflicts (`etc/stx.conf`)

0.9.12 (2026-06-14)
-------------------

- FEATURE: add support for OpenAI Codex CLI
- FEATURE: provide `ase-meta-compat` skill to self-test agent/LLM compatibility to ASE (`ase-compat.ts`)
- IMPROVEMENT: improve reading/writing to stdin to be more robust and Codex-ready (`ase-hook.ts`)
- IMPROVEMENT: add OpenAI Codex compatibility table and more models to README (`README.md`)
- IMPROVEMENT: update workflow diagram for compat skill (`docs/workflow.*`)
- CLEANUP: avoid colons to not confuse parsing and align dialog wording (`ase-code-{craft,refactor,resolve}`, `ase-task-grill`)

0.9.11 (2026-06-14)
-------------------

- IMPROVEMENT: support `-h`/`--help` option via getopt across many skills (`ase-arch-analyze`, `ase-code-explain`, `ase-code-insight`, `ase-meta-changelog`, `ase-meta-chat`, `ase-meta-commit`, `ase-meta-evaluate`, `ase-meta-persona`, `ase-task-delete`, `ase-task-id`, `ase-task-rename`)
- IMPROVEMENT: use `custom-dialog` and improve timestamp handling in `ase-task-grill` skill
- IMPROVEMENT: do not hard-code to 4 answers in `ase-meta-brainstorm` skill
- IMPROVEMENT: be more precise on `-n`/EDIT in `ase-code-{craft,refactor,resolve}` skills
- IMPROVEMENT: improve OTHER handler in `ase-code-lint` and `ase-docs-proofread` skills
- IMPROVEMENT: handle the no-foreign-LLMs (no-quorum) case in `ase-meta-quorum` skill
- IMPROVEMENT: validate task ids in `ase-task-rename` skill
- IMPROVEMENT: allow missing top-level header of next version in `ase-meta-changelog` skill
- IMPROVEMENT: be more precise and bullet-proof in `ase-task-id` and `ase-code-analyze` skills
- BUGFIX: validate the kv lookup before switching the session task in `ase-code-resolve` skill
- BUGFIX: surface minimum count of highest-ranked items in `ase-meta-diaboli` and `ase-meta-steelman` skills
- BUGFIX: evaluate all-negative check before small-distance check in `ase-meta-evaluate` skill
- BUGFIX: fix intent-group line-count reference in `ase-meta-diff` skill
- BUGFIX: fix step numbering in `ase-arch-discover` skill
- CLEANUP: cleanup control structure in `ase-task-reboot` skill

0.9.10 (2026-06-14)
-------------------

- FEATURE: distinguish dialogs that allow free-text instructions from those that do not (`ase-dialog.md`, many skills)
- IMPROVEMENT: force the agent harness harder to no longer use its own user dialog and suppress end-of-skill summaries (many skills, `ase-skill.md`)
- IMPROVEMENT: improve `custom-dialog`, disambiguate internal step cross-references, and restrict to 2–9 options (`ase-dialog.md`)
- IMPROVEMENT: improve box rendering and render ASE banner in black (`ase-skill.md`)
- IMPROVEMENT: improve rendering of approaches in `ase-code-{craft,refactor,resolve}` skills
- IMPROVEMENT: support Copilot's `web_search` tool in `ase-meta-search` skill
- IMPROVEMENT: allow more Bash commands for the `ase-code-insight` skill itself
- IMPROVEMENT: avoid placeholder namespace conflicts in `ase-meta-brainstorm` skill
- IMPROVEMENT: detect when minimum rank is not reached at all in `ase-meta-brainstorm` skill
- BUGFIX: bind `chosen-k` placeholder to the chosen candidate index in `ase-meta-why` skill
- BUGFIX: avoid Agent name conflicts in `ase-code-lint` and `ase-docs-proofread` skills
- BUGFIX: fix cross-reference targets in `ase-format-arch.md`
- BUGFIX: fix step marker in `ase-arch-discover` skill
- BUGFIX: fix end tag in `ase-code-{craft,refactor,resolve}` skills
- BUGFIX: fix proofread results in `ase-meta-diaboli` and `ase-meta-diff` skills
- CLEANUP: cleanup Specification format (`ase-format-spec.md`)
- CLEANUP: cleanup local getopt parsing in `ase-getopt.md`
- CLEANUP: cleanup dialog processing in `ase-dialog.md`
- CLEANUP: align syntax with other skills in `ase-meta-brainstorm` skill

0.9.9 (2026-06-13)
------------------

- FEATURE: add focus-mode-capable `custom-dialog` construct (non-`AskUserQuestion`) for intermediate questions (`ase-dialog.md`)
- IMPROVEMENT: migrate skills to `custom-dialog` for Claude Code focus-mode support (task-*, code-*, docs-proofread, meta-brainstorm)
- IMPROVEMENT: migrate `ase-code-{craft,refactor,resolve}` skills to the `<flow>`/`<step>` mechanism
- IMPROVEMENT: make steps ordered and use `custom-dialog` in `ase-arch-discover` skill
- IMPROVEMENT: support auto-approval of the `Edit` tool for some skills (`ase-hook.ts`)
- IMPROVEMENT: add numbered-key and box-drawing/padding render helpers (`ase-skill.md`)
- IMPROVEMENT: strengthen the local option-parsing optimization pressure (`ase-getopt.md`)
- IMPROVEMENT: support double-backtick code spans with escaped backticks (`ase-markdown.ts`)
- IMPROVEMENT: allow statusline chunks to line-break within color spans (`ase-statusline.ts`)
- IMPROVEMENT: add hyperlinks to all skill `help.md` files
- IMPROVEMENT: handle restarts where the service port could have changed (`ase-service.ts`)
- IMPROVEMENT: enforce `project.artifact.task.files` glob symmetrically across all task operations (`ase-task.ts`)
- IMPROVEMENT: follow non-quiet failure handling in the quiet path on final attempt in `ase setup` (`ase-setup.ts`)
- BUGFIX: do not set `agent.skill` from hooks as it cannot be reliably cleared again (`ase-hook.ts`)
- BUGFIX: remove the optional diagram from `ase-code-*` skills as it conflicts with focus mode
- BUGFIX: fix mis-slicing of verbatim trailing-arg string for value-consuming options (`ase-getopt.ts`)
- BUGFIX: make MCP HTTP close/shutdown/reconnect handling more robust (`ase-mcp.ts`)
- BUGFIX: prevent `computeRank` from collapsing to zero on genuine `0` or unavailable metrics (`ase-skills.ts`)
- BUGFIX: fix regexp and comment format in `ase-task.ts`
- BUGFIX: fix grammar in `ase-meta-brainstorm` and `ase-meta-diff` skills
- UPDATE: upgrade NPM dependencies
- REFACTOR: factor out similar code to shrink `ase-setup.ts`
- REFACTOR: use the `HOST` variable for alignment and improve portability (`ase-service.ts`, `ase-hook.ts`)
- CLEANUP: align skill style and wording across `ase-code-*`, dialog, and meta files

0.9.8 (2026-06-12)
------------------

- FEATURE: add `<elseif>`/`<else>` control constructs and improve control flow (`ase-control.md`)
- IMPROVEMENT: avoid redundant `ase_task_load` round-trips in skill hand-offs via internal `--int-reuse-task` option
- IMPROVEMENT: hide internal `--int-*` options from the `ase_getopt` usage help and `info` rendering
- IMPROVEMENT: speed up task-list processing via parallel `TaskCreate` plus explicit `TaskUpdate` ordering
- IMPROVEMENT: let `ase-code-{craft,refactor,resolve}` skills trigger more often implicitly
- IMPROVEMENT: match task plan `Modified:` field via icon prefix for more precise detection
- IMPROVEMENT: allow underscores in task identifiers (`ase-task.ts`)
- IMPROVEMENT: improve control flow and precision in `ase-meta-{why,steelman,review,quorum}` skills
- IMPROVEMENT: align outputs across `ase-code-{craft,resolve}` skills
- BUGFIX: do not rewrite the Markdown task format on save, only on load (`ase-task.ts`)
- BUGFIX: list tasks with underscores in the name correctly (`ase-task.ts`)
- BUGFIX: do not prefix result with tool name to avoid skill error-handling confusion (`ase-task.ts`)
- BUGFIX: handle OTHER user-dialog case in `ase-task-{grill,implement,preflight,reboot,condense}` skills
- BUGFIX: fix timestamp handling in `ase-task-{reboot,grill}` skills
- BUGFIX: reuse plan only if it was really changed in `ase-task-edit` skill
- BUGFIX: set `ase-task-id` only if a rename actually happened in `ase-task-rename` skill
- BUGFIX: fix `--full` option docs and header name in `ase-task-view` help
- BUGFIX: handle `-n EDIT` and fix id handling in `ase-code-{craft,refactor,resolve}` skills
- BUGFIX: avoid colons in Agent names in `ase-code-explain` skill
- BUGFIX: do not count blank lines in `ase-code-insight` skill
- BUGFIX: fix skill name in MCP tool call in `ase-code-lint` skill
- BUGFIX: fix unified-diff context information in `ase-code-lint` and `ase-docs-proofread` skills
- BUGFIX: fix off-by-one error in `ase-docs-proofread` agent
- BUGFIX: use unique Agent names in `ase-meta-search` skill
- BUGFIX: fix option value validation in `ase-meta-quorum` skill
- BUGFIX: guard zero best-rating before dividing in `ase-meta-evaluate` percentage calculation
- BUGFIX: fix small-distance branch case in `ase-meta-evaluate` skill
- BUGFIX: handle `OTHER:`/`ERROR:` results in `ase-meta-brainstorm` and avoid answer starvation
- BUGFIX: align `ase-meta-diff` help with its table rendering and add missing close-tag
- BUGFIX: error on unknown technology stacks in `ase-arch-discover` skill
- BUGFIX: fix Maven URL usage and name references in `ase-arch-discover` skill
- BUGFIX: clamp `--limit` correctly in `ase-docs-distill` skill
- UPDATE: refresh the agentic-levels workflow diagram (Graffle/SVG/PDF)
- REFACTOR: adopt newer `<elseif>`/`<else>` control constructs across all skills
- CLEANUP: adjust skills for the newer task plan format and fix minor wording/types
- CLEANUP: consistently use the space-glob pattern variant in `ase-arch-analyze` and `ase-meta-diff` skills
- CLEANUP: remove not-implemented RIPPLE information from `ase-meta-diff` help
- CLEANUP: remove extra output in `ase-arch-analyze` skill
- CLEANUP: cleanup `ase-code-analyze`, `ase-task-delete`, and `ase-task-edit` skills and docs
- UPDATE: upgrade NPM dependencies

0.9.7 (2026-06-10)
------------------

- FEATURE: add `ase_markdown_prepare` MCP tool and `Markdown.prepare()` helper to improve Markdown rendering
- FEATURE: add option `--full`/`-f` to `ase-task-view` to not truncate IMPLEMENTATION DRAFT sections by default
- IMPROVEMENT: keep fenced code blocks as-is in `Markdown.prepare()`
- IMPROVEMENT: improve rendering of approaches in `ase-code-{craft,refactor,resolve}` skills
- IMPROVEMENT: strengthen and clarify the `ase-task-grill` skill
- REFACTOR: apply `Markdown.prepare()` implicitly in `ase_task_{load,save}`
- REFACTOR: adjust all skills for the improved task rendering
- UPDATE: upgrade NPM dependencies

0.9.6 (2026-06-08)
------------------

- FEATURE: add `ase_artifact_name(kind, name)` MCP tool and `ase artifact name --kind <kind> <name>` CLI to create artifact filenames
- FEATURE: add `ase_artifact_list(kind)` MCP tool and `ase artifact list --kind` CLI to resolve artifact kinds to project files
- FEATURE: add missing `ase config delete` CLI sub-command to delete a configuration key
- FEATURE: add `project.artifact.{spec,arch,code,docs,infr}.{basedir,files}` config vars
- REFACTOR: add `project.artifact.task.{basedir,files}` config vars and store tasks as `<basedir>/TASK-<id>.md` files
- CLEANUP: add automatic migration of legacy `<basedir>/<id>/plan.md` task files to `<basedir>/TASK-<id>.md`
- CLEANUP: rename plugin/meta/ase-format-plan.md to plugin/meta/ase-format-task.md

0.9.5 (2026-06-07)
------------------

- FEATURE: add `--max-clarify`, `--min-rank`, and `--max-shortlist` options to `ase-meta-brainstorm` to control internals
- FEATURE: add `--width`/`-w` option to `ase-meta-why` to weigh several candidate sub-causes per level and backtrack
- FEATURE: add `--models`/`-m` model-selection option to `ase-meta-quorum` to choose which foreign LLMs are queried
- FEATURE: add `--services`/`-s` backend-selection option to `ase-meta-search` to choose which search services are queried
- FEATURE: add `--limit`/`-l=12` option to `ase-arch-discover` to make the component discovery search and result cap user-controlled
- BUGFIX: ensure that the "name" field of "Agent" calls is a valid string

0.9.4 (2026-06-07)
------------------

- FEATURE: add `--severity`/`-S` severity-floor option to `ase-meta-review` to suppress sub-threshold findings
- FEATURE: add `--severity`/`-S` severity-floor option to `ase-code-lint` and `ase-code-analyze` to suppress sub-threshold findings
- FEATURE: add `--performance`/`-p` and `--security`/`-s` lens options to `ase-code-analyze` for additional analyze lenses
- FEATURE: add `--depth`/`-d` option to `ase-meta-why` to make the Five-Whys chain length tunable
- FEATURE: add `--count`/`-c=12` option to `ase-meta-brainstorm` controlling the minimum number of candidate ideas in the diverge phase
- FEATURE: add `--rounds`/`-r` option to `ase-meta-steelman` for iterative fortification rounds
- FEATURE: add `--count`/`-c=10` option to `ase-meta-diaboli` and `ase-meta-steelman` for the number of anti-theses/pro-theses surfaced
- FEATURE: add `tokei` build target for project statistics in `etc/stx.conf`
- IMPROVEMENT: refactor `ase-meta-diaboli` and `ase-meta-steelman` to use flow/step control structures
- IMPROVEMENT: clarify analysis hints are non-exhaustive indicators in `ase-code-analyze`
- UPDATE: link to sibling project `bash-authorize` and bump Artifact Formats progress in README
- CLEANUP: apply proofread fixes in `ase-docs-distill`, `ase-meta-brainstorm`, `ase-task-grill` skills

0.9.3 (2026-06-06)
------------------

- FEATURE: add `ase-docs-distill` skill for distilling importance-ranked list of key points of documents
- FEATURE: add `ase-meta-steelman` skill for constructing the strongest possible case for a thesis
- FEATURE: add `ase-meta-review` skill for holistic, human-reviewer-style critique of staged Git changes
- FEATURE: add `--coherence` option to `ase-meta-diff` to reconstruct the single intended change and flag hunks that do not serve it
- FEATURE: add ESLint-based Markdown linting and fix all Markdown files accordingly
- IMPROVEMENT: add support for conditional steps in skill control flow (`ase-control.md`)
- IMPROVEMENT: constrain `ase-meta-brainstorm` to fewer clarifications and a bolder statement
- BUGFIX: accept numeric Unix timestamp for rate-limit `resets_at` in `ase-statusline.ts`
- UPDATE: refresh and improve the workflow diagram (Graffle/SVG/PDF)
- UPDATE: update documentation to reflect current code state (AGENTS.md, README, usage docs)
- UPDATE: upgrade NPM dependencies
- CLEANUP: silence linter and markdownlint warnings

0.9.2 (2026-06-05)
------------------

- FEATURE: add State Model, Glossary, and Business Rules artifacts to Specification format (`ase-format-spec.md`)
- FEATURE: add `upd` build target for updating package.json files in `etc/stx.conf`
- IMPROVEMENT: improve Specification format rendering and add cross-reference information across SPEC/ARCH format definitions
- IMPROVEMENT: add sequence-number filename prefix, Pascal-cased slugs, and numbered Artifact lists to SPEC/ARCH formats
- IMPROVEMENT: align `ase-format-arch.md` formatting and conventions with the newer SPEC format
- CLEANUP: merge ase-format-adr.md into the newer ase-format-arch.md
- CLEANUP: enforce consistent line-breaking, blank lines, and spacing in format definitions

0.9.1 (2026-06-05)
------------------

- FEATURE: add new `ase-task-condense` skill for condensing task plan texts (telegrapher-like, semantics-preserving)
- FEATURE: auto-approve addon MCP (chat-*/search-*) tool invocations in pre-tool-use hook (`ase-hook.ts`)
- FEATURE: provide the first cut for Specification and Architecture format definitions
- IMPROVEMENT: refine README wording on result quality and feature-status notices
- IMPROVEMENT: ase-task-edit: replace explicit REFINE option with GRILL option (more useful)
- IMPROVEMENT: make approach output more concise in `ase-code-{craft,refactor,resolve}` skills
- UPDATE: refresh workflow diagram for `ase-task-condense` skill (Graffle/SVG/PDF)
- CLEANUP: change README status notice admonition from CAUTION to NOTE
- CLEANUP: fix proofreading typos in `ase-meta-brainstorm` and `ase-task-grill` skills

0.9.0 (2026-06-03)
------------------

- REFACTOR: consolidate MCP bridge reconnect handling into idempotent `triggerReconnect` helper in `ase-mcp.ts`
- CLEANUP: simplify `runBridge` return handling and `loadContext` identity loading in `ase-mcp.ts`
- UPDATE: upgrade NPM dependencies

0.0.62 (2026-06-03)
-------------------

- IMPROVEMENT: document new `ase-meta-brainstorm` skill and `ase-format-adr.md` ADR conventions (AGENTS.md, README, usage-plugin.md)
- IMPROVEMENT: improve `ase-code-lint` skill with `file:line` references and optical WHAT/WHY separation
- REFACTOR: factor out ANSI-sequence scanning and reduce redundancy in `ase-diagram.ts`
- CLEANUP: rename ase-meta-changes → ase-meta-changelog to reduce confusion with ase-meta-diff
- CLEANUP: simplify `ase-diagram.ts` and `ase-statusline.ts` code
- CLEANUP: align `ase-persona` MCP tool description and session-id validation with skill
- CLEANUP: adjust README skill-table layout to balance columns
- CLEANUP: fix vendor name "GitHub" in README

0.0.61 (2026-06-03)
-------------------

- FEATURE: add new `ase-meta-diff` skill summarizing staged Git changes as intents with optional risks and blast radius
- FEATURE: add new `ase-meta-brainstorm` skill for finding ideas with a single-diamond (diverge/converge) method
- IMPROVEMENT: centrally provide output templates in `ase-skill.md` and adopt them across skills
- IMPROVEMENT: rework `ase-meta-diff` intent report into two aligned Markdown tables
- IMPROVEMENT: document new `ase-meta-diff` skill (AGENTS.md, README, usage-plugin.md)
- UPDATE: refresh workflow diagram for new `ase-meta-diff` skill (Graffle/SVG/PDF)
- CLEANUP: replace the sometimes not expanded HTML entities for the colored bullets with XML placeholders of direct Unicode characters
- CLEANUP: silence linter and markdownlint warnings

0.0.60 (2026-05-31)
-------------------

- IMPROVEMENT: add -Q/--quick option as an alias for "-a -d -n IMPLEMENT,DELETE" in ase-code-{craft,refactor,resolve} skills
- BUGFIX: allow once again the "ase-task-delete" to be called from other skills

0.0.59 (2026-05-31)
-------------------

- FEATURE: add (still unused) ADR format definition in `plugin/meta/ase-format-adr.md`
- IMPROVEMENT: let -n/--next in ase-code-{craft,resolve,refactor}, ase-task-{edit,implement,preflight,reboot,grill} accept a comma-separated chronological list of tokens
- IMPROVEMENT: add new "ase-task-grill" skill for challenging the task aspects
- IMPROVEMENT: add new "ase-meta-diaboli" skill for playing Devil's Advocate (Advocatus Diaboli)
- IMPROVEMENT: increase "effort" level in various skills to improve precise operation
- IMPROVEMENT: substantially rework README (skill mix, sample-session GIF/video, section sorting, rendering)
- IMPROVEMENT: document `ase-task-grill` and `ase-meta-diaboli` skills (AGENTS.md, README, usage-plugin.md, help)
- BUGFIX: prevent `ase-getopt` skill from being automatically called by the model
- UPDATE: refresh workflow diagram for diaboli/grill skills (Graffle/SVG/PDF)
- CLEANUP: align `ase-meta-why` skill style to other skills
- CLEANUP: rename plugin/meta/ase-plan.md to plugin/meta/ase-format-plan.md

0.0.58 (2026-05-29)
-------------------

- IMPROVEMENT: let ase-code-{craft,resolve,refactor} and ase-task-edit also take CHANGELOG.md files into account
- IMPROVEMENT: introduce -d/--dry option to ase-code-{craft,resolve,refactor} and ase-task-edit skills for skipping verifications
- IMPROVEMENT: speed up option parsing by skipping MCP tool use when arguments do not start with any option
- IMPROVEMENT: reduce "ase-task-edit" skill by 2K by factoring out equal text blocks into <define>
- IMPROVEMENT: substantially rework README for readability (rewording, three-column layout, full-width usage, motivation section, skill links and updated skill list)
- UPDATE: refresh building-blocks, agentic-levels, and workflow diagrams (Graffle/SVG/PDF)
- CLEANUP: ignore extra spaces in `plugin/etc/markdownlint.yaml`

0.0.57 (2026-05-28)
-------------------

- FEATURE: add `--help`/`-h` option infrastructure with per-skill `help.md` files for all skills
- IMPROVEMENT: speed up `ase-code-{craft,refactor,resolve}` skills by going directly to implementation/preflight if requested
- IMPROVEMENT: announce `--help`/`-h` option in argument-hint and frontmatter across all skills
- IMPROVEMENT: use space as option separator in argument-hint across skills
- IMPROVEMENT: wrap all skill objectives in `<objective>` XML tag and add missing objective blocks
- CLEANUP: remove <role/> information from all skills as it makes no real effect for the skills
- CLEANUP: remove all H1 headers from all skills as it makes no real effect for the skills
- CLEANUP: show skill options also in frontmatter "argument-hint"
- CLEANUP: small cleanups to `ase-constitution.md`, `ase-skill.md`, and `ase-getopt.md`

0.0.56 (2026-05-28)
-------------------

- IMPROVEMENT: validate task `id` parameter in `ase-task-{delete,implement,preflight,reboot,view}` skills
- IMPROVEMENT: properly quote string parameters in MCP tool calls across multiple skills and `ase-getopt.md`
- IMPROVEMENT: handle error responses in `ase-task-{implement,preflight,reboot}` skills
- IMPROVEMENT: refine `ase-task-edit` skill (clearer questions, looping, OTHER option on plan dialog, inherited session id, precision)
- IMPROVEMENT: make `<expand>` control construct more robust in `ase-control.md`
- BUGFIX: handle WHY-only case in `ase-task-reboot` skill
- BUGFIX: fix transposed decision matrix evaluation in `ase-meta-evaluate` skill
- BUGFIX: fix references to search MCP servers in `ase-meta-search` agent
- BUGFIX: fix destructuring information in `ase-arch-discover` skill
- BUGFIX: fix wrong placeholder reference in `ase-dialog.md`
- BUGFIX: fix typo in `ase-task-edit` skill

0.0.55 (2026-05-27)
-------------------

- IMPROVEMENT: support also single-character task ids in `ase-code-craft` and `ase-code-resolve` skills
- IMPROVEMENT: add missing entries to `ase-meta-quorum` skill
- IMPROVEMENT: avoid reading config twice in `ase-hook`
- BUGFIX: honor also `WARNING:` results in `ase-task-delete` and `ase-task-view` skills
- CLEANUP: simplify code by eliminating redundancies in `ase-setup`
- CLEANUP: clean up code in `ase-config` and `ase-diagram`
- CLEANUP: fix typos in `ase-meta-changes` skill

0.0.54 (2026-05-26)
-------------------

- IMPROVEMENT: rework `ase-meta-changes` skill to also consult staged Git changes
- IMPROVEMENT: optimize tail-reading performance in `ase-service`
- IMPROVEMENT: use consistent `ase_task_*` result message prefixes in `ase-task`
- BUGFIX: validate `--tool` value from `ASE_TOOL` in `ase-setup` and `ase-statusline`
- UPDATE: adjust reasoning effort in several `ase-arch/code/meta/task` skills
- CLEANUP: remove obsolete "ase-code-lint:xxx" commands
- CLEANUP: fix spelling in `ase-meta-quorum` and `ase-meta-search` skills

0.0.53 (2026-05-26)
-------------------

- REFACTORING: prefix all MCP tools with "ase_" (technically not necessary, but more precise matching possible)
- BUGFIX: fix parameter name in "ase-meta-chat" agent
- BUGFIX: fix malformed "tools" field in frontmatter of "ase-meta-search"

0.0.52 (2026-05-25)
-------------------

- IMPROVEMENT: mark level in verbose outputs of STX build tasks
- UPDATE: upgrade NPM dependencies
- CLEANUP: clean up STX build tasks in `etc/stx.conf`
- CLEANUP: clean up README.md

0.0.51 (2026-05-25)
-------------------

- IMPROVEMENT: add `ase setup mcp list|activate|deactivate` tool for managing foreign MCP servers
- IMPROVEMENT: add Z.AI GLM and Alibaba Qwen LLMs to `ase-meta-quorum` and `ase-meta-chat`
- IMPROVEMENT: raise effort to high in `ase-meta-diagram` agent for more precise instruction following
- BUGFIX: sanitize keys in the `ase setup mcp` output
- UPDATE: add references to README
- REFACTOR: rework `ase-meta-chat` agent for the unified `query` MCP tool
- CLEANUP: clean up and restructure `ase-meta-search` skill and agent
- CLEANUP: ignore `.env` files in `.gitignore` and `.npmignore`

0.0.50 (2026-05-25)
-------------------

- IMPROVEMENT: improve agent-usage guidance in `ase-meta-quorum` skill
- IMPROVEMENT: clean up and restructure `ase-meta-search` skill
- IMPROVEMENT: regroup the USP overview in README
- BUGFIX: fix obsolete-parameter references in `ase-statusline`
- BUGFIX: re-read config before write to avoid clobbering stale task id in `ase-hook`
- CLEANUP: use namespaced agent references in `ase-code-lint` and `ase-docs-proofread` skills
- CLEANUP: clean up `ase-meta-quorum` skill and remove blank line in `ase-meta-chat` agent
- CLEANUP: remove obsolete `ase-meta-diagram` skill file
- CLEANUP: fix punctuation and spellings in README and docs
- CLEANUP: update workflow diagram
- REFACTOR: move logic from "ase-meta-chat" skill to the corresponding agent
- REFACTOR: convert "ase-meta-diagram" skill into a sub-agent and route all callers through the `Agent` tool

0.0.49 (2026-05-24)
-------------------

- IMPROVEMENT: reimplement "ase-code-lint" skill based on "ase-docs-proofread" agent-based skill mechanics
- IMPROVEMENT: add "ase-task-rename" skill, MCP tool and CLI command
- IMPROVEMENT: append "-usage" suffix to weekly/session usage labels in `ase-statusline`
- BUGFIX: fix argument parsing in `getopt` MCP tool
- BUGFIX: always lint before version bump on "npm start publish" procedure
- BUGFIX: protect service stop and remove event listeners later in `ase-service`
- CLEANUP: harden JSON parsing and refactor redundant code in `ase-hook`
- CLEANUP: clean up code across `ase-mcp`, `ase-statusline`, `ase-task` and `ase-config`
- CLEANUP: update workflow diagram to reflect recent changes
- CLEANUP: fix various remaining proofread problems in texts

0.0.48 (2026-05-24)
-------------------

(skipped because of publish problem)

0.0.47 (2026-05-24)
-------------------

(skipped because of publish problem)

0.0.46 (2026-05-24)
-------------------

- FEATURE: allow `ase config` to be managed via MCP, too
- IMPROVEMENT: greatly improve `ase-docs-proofread` skill (better interactive dialog, sub-agent for investigation, more precise output)
- IMPROVEMENT: add Java/Kotlin/Maven package support to `ase-arch-discover` skill
- BUGFIX: fix argument parsing with glob patterns in skill option parsing
- CLEANUP: fix many proofreading problems across documents

0.0.45 (2026-05-24)
-------------------

- IMPROVEMENT: add new "ase-docs-proofread" skill
- IMPROVEMENT: add docs/agentic-software-engineering.md for some definitions
- IMPROVEMENT: improve rendering of README.md
- CLEANUP: fix many proofreading problems

0.0.44 (2026-05-23)
-------------------

- IMPROVEMENT: further improve persona style in `ase-persona.md`

0.0.43 (2026-05-23)
-------------------

- IMPROVEMENT: further improve persona style in `ase-persona.md`
- BUGFIX: fix typo in `ase-meta-changes` skill
- UPDATE: upgrade NPM dependencies
- UPDATE: update documentation (AGENTS.md, configuration, setup, usage-tool) to reflect reality
- UPDATE: refine README wording for more precision
- CLEANUP: add back missing trailing blank lines in meta and skill files
- CLEANUP: explicitly ignore `node_modules` also in plugin subdirectory

0.0.42 (2026-05-23)
-------------------

- FEATURE: add KV batch interface MCP tool to speed up `ase-code-analyze` skill
- IMPROVEMENT: improve the tenets in the craft/resolve/refactor skills
- IMPROVEMENT: improve and lighten the output styling across skills
- BUGFIX: various bugfixes to KV store
- CLEANUP: reformat "ase-code-analyze" skill
- CLEANUP: various cleanups to KV store and skills

0.0.41 (2026-05-23)
-------------------

- IMPROVEMENT: rate-limit the HTTP requests in ase-skills.ts to 4 concurrent ones
- IMPROVEMENT: migrate the weighted decision matrix calculation of the "evaluate" skill into an MCP tool
- IMPROVEMENT: migrate the parallel WebFetch and sorting functionality of the "discover" skill into an MCP tool
- IMPROVEMENT: add USP/Crux/Gotcha overview table also to "discover" skill
- REFACTOR: migrate from Axios to OFetch NPM package
- CLEANUP: remove inclusion of "ase-persona.md" from all skill files (is part of constitution)

0.0.40 (2026-05-22)
-------------------

- CLEANUP: be more precise in calling the "Skill" tool
- REFACTORING: factor out control constructs from ase-skill.md into ase-control.md to have them available for ase-persona.md

0.0.39 (2026-05-22)
-------------------

- IMPROVEMENT: refine `ase-code-craft`, `ase-code-refactor`, and `ase-code-resolve` skills
- IMPROVEMENT: directly transition at end of craft/refactor/resolve to edit skill

0.0.38 (2026-05-22)
-------------------

- IMPROVEMENT: reduce verbose LLM output in `ase-meta-evaluate` skill
- IMPROVEMENT: derive a task id if the current is still "default" in craft/resolve/refactor skills
- BUGFIX: automatically choose "sudo" for "npm install -g" commands when necessary in "ase setup"
- BUGFIX: also set ase-task-id in `ase-code-resolve` skill

0.0.37 (2026-05-21)
-------------------

- IMPROVEMENT: add -v|--verbose option to "ase-task-list" skill for explicitly requesting verbose output
- IMPROVEMENT: add support (via hooks) for agent ready/busy status which is sent to tmux
- IMPROVEMENT: add GitHub Copilot support under PowerShell (including newer hooks)
- BUGFIX: remove obsolete matcher in plugin hooks
- CLEANUP: use consistent naming of dialog across skills

0.0.36 (2026-05-18)
-------------------

- IMPROVEMENT: add missing `<skill>` tags to multiple skills (arch-discover, code-*, meta-*)
- IMPROVEMENT: give persona style more ability to overrule skill rules in ase-skill.md
- IMPROVEMENT: restructure README (move setup section to top)
- BUGFIX: fix counting in `ase-meta-quorum` and `ase-meta-evaluate` skills
- BUGFIX: fix block count in `ase-arch-analyze` skill
- BUGFIX: fix XML, regexp, JSON, and other syntax issues in ase-getopt.md
- BUGFIX: fix multiple issues in ase-dialog.md (require minimum 2 options for user dialog tools)
- BUGFIX: add missing closing quote in ase-code-{craft,refactor,resolve} and ase-task-{edit,implement,preflight,reboot} skills
- BUGFIX: fix logic of -a/--auto option in ase-code-{craft,refactor,resolve} skills
- UPDATE: document design decisions and OS context in README
- CLEANUP: reduce ambiguity and clean up semantics in ase-skill.md, ase-plan.md, and multiple skills
- CLEANUP: small cleanups across skills

0.0.35 (2026-05-18)
-------------------

- BUGFIX: commit also plugin/package.json updates on "npm start publish"

0.0.34 (2026-05-18)
-------------------

- IMPROVEMENT: draw an operation modes matrix diagram
- BUGFIX: replace version on "npm start publish" also in plugin/package.json
- CLEANUP: crop diagram SVGs

0.0.33 (2026-05-18)
-------------------

- IMPROVEMENT: add "ase setup enable" and "ase setup disable" for enabling/disabling ASE in the agent tool
- IMPROVEMENT: truncate IMPLEMENTATION DRAFT section in "ase-task-edit" skill
- IMPROVEMENT: add a ase-getopt.md (plugin) and ase-getopt.ts (tool) for option parsing
- IMPROVEMENT: support option -a|--auto (prefer A1) and -n|--next (choose step) in "ase-code-{craft,refactor,resolve}" skills
- IMPROVEMENT: support option -n|--next (choose step) in "ase-task-{edit,implement,preflight,reboot}" skills
- IMPROVEMENT: support option -p|--plan (choose previous-plan handling) in "ase-task-edit" skill
- BUGFIX: fix bundling of plugin into tool
- BUGFIX: try to force "ase-code-{craft,refactor,resolve}" skills even harder to not immediately implement.

0.0.32 (2026-05-18)
-------------------

- IMPROVEMENT: add markdown linting infrastructure to plugin directory
- IMPROVEMENT: provide PDF versions of docs diagrams
- UPDATE: add GitHub Copilot CLI information to README
- BUGFIX: fix docs/workflow diagram source and SVG
- CLEANUP: fix markdown linting issues in plugin skills and meta files

0.0.31 (2026-05-18)
-------------------

- IMPROVEMENT: as "claude plugin install" does not support pinned versions, install plugin from bundled version of NPM package
- IMPROVEMENT: provide `<ase-agent-tool/>` in context and `ASE_AGENT_TOOL` in environment to identify the agent tool
- IMPROVEMENT: make skills more portable by using `AskUserQuestion` in Claude Code and `ask_user` in GitHub Copilot CLI
- IMPROVEMENT: add `<skill>` tags and objectives to all `ase-task-*` skills and use them in skill-started status output
- IMPROVEMENT: add kv-store persistence of findings to `ase-arch-analyze` skill and unify kv key naming
- IMPROVEMENT: improve status output and display ASE version during setup operations
- BUGFIX: fix wrong description in `ase-task-delete` skill frontmatter

0.0.30 (2026-05-17)
-------------------

- REVAMPING: reimplement ase-task-* skills to no longer use agent
  harness "plan mode" as especially the `ExitPlanMode` tool is Claude
  Code specific and cannot be customized or controlled in any
  reasonable way.

0.0.29 (2026-05-16)
-------------------

- IMPROVEMENT: at end of craft/resolve/refactor skills, interactively ask for next step
- IMPROVEMENT: provide a key/value storage MCP tool set for temporary information sharing in skills
- IMPROVEMENT: use new key/value MCP for persisting problems between "ase-code-analyze" and "ase-code-resolve"
- IMPROVEMENT: add package-cohesion audit aspects (SA19-SA21) to ase-arch-analyze skill
- IMPROVEMENT: use atomic cross-process config file management to avoid conflicts
- IMPROVEMENT: improve port handling and timeout handling in MCP service shutdown
- IMPROVEMENT: improve SIGKILL handling and track in-flight requests in MCP service
- BUGFIX: correctly quote arguments on env variable exports in session-start hook
- BUGFIX: fix MCP service reconnect logic
- BUGFIX: fix root-level config validation
- BUGFIX: fix config path up-walking
- BUGFIX: always set task id in session-start hook
- BUGFIX: fix scope information display in ase config
- REFACTOR: move "timestamp" MCP tool into its own ase-timestamp.ts module

0.0.28 (2026-05-16)
-------------------

- IMPROVEMENT: add a "session-end" hook for removing the session storage again
- IMPROVEMENT: store tasks per project and not per user
- IMPROVEMENT: support more elaborate age specification in "ase task purge" command
- REFACTORING: bundle logic, CLI parsing and MCP service registration together
- REFACTORING: move shared service probing into service functionality

0.0.27 (2026-05-16)
-------------------

- IMPROVEMENT: render the `ase-task-list` output as a Markdown table with mtime information
- IMPROVEMENT: support `<break/>` construct for early stop of `<for/>` repetition in skills
- IMPROVEMENT: clarify XML syntax usage in meta skill for more precise LLM behavior
- IMPROVEMENT: align outputs across skills (`ase-task-list`, craft/refactor/resolve family, etc.)
- IMPROVEMENT: provide fallback definition for disagreement in `ase-meta-quorum` skill
- IMPROVEMENT: add agentic levels diagram with descriptions to documentation
- IMPROVEMENT: provide rough Java/Kotlin package support in `ase-code-insight` skill
- IMPROVEMENT: improve TypeScript typing (use `unknown` for caught errors) in tool
- IMPROVEMENT: verify given session id in `ase hook session-start`
- BUGFIX: ensure skills apply `agent.persona` style correctly
- BUGFIX: make constitution semicolon/brace prohibitions language-aware
- BUGFIX: fix allowed-tools lists and add missing tool entries in multiple skills
- BUGFIX: fix typos, wrong references, and syntax issues across skills
- BUGFIX: fix logic bug in skill control-flow handling
- BUGFIX: use newer `timestamp` MCP tool (drop positional parameter)
- BUGFIX: do not leak resource in MCP service probe
- BUGFIX: omit clearing plan mode outside plan mode in `ase-task-edit`
- BUGFIX: fix swapped tool and plugin in startup output
- REFACTOR: split `task list` functionality into own `ase-task-list` skill
- REFACTOR: factor out identical probe code into own module in MCP service
- UPDATE: upgrade NPM dependencies
- CLEANUP: multiple cleanups to various skills
- CLEANUP: cleanup `ase-task-list` skill
- CLEANUP: remove debugging leftovers

0.0.26 (2026-05-13)
-------------------

- IMPROVEMENT: speed up startup times by migrating from "npm view" to cache-using "update-notifier"
- IMPROVEMENT: provide Claude Code and ASE version in statusline under %V
- CLEANUP: rename "ase statusline" placeholder %o to %O for output style

0.0.25 (2026-05-13)
-------------------

- IMPROVEMENT: rename skills for clearer grouping: `ase-meta-task` →
  `ase-task-id`, `ase-spec-edit` → `ase-task-edit`, `ase-spec-implement`
  → `ase-task-implement`, `ase-spec-preflight` → `ase-task-preflight`,
  `ase-code-changes` → `ase-meta-changes`, `ase-code-commit` →
  `ase-meta-commit`

0.0.24 (2026-05-11)
-------------------

- IMPROVEMENT: improve edit skill to honor a task-id
- CLEANUP: code cleanups

0.0.23 (2026-05-11)
-------------------

- IMPROVEMENT: add "timestamp" MCP tool to service for use by skills
- IMPROVEMENT: support task id as prefix for craft/refactor/resolve skills
- IMPROVEMENT: use new "timestamp" MCP tool instead of Bash(date) to figure out time
- CLEANUP: align craft/refactor/resolve skills

0.0.22 (2026-05-10)
-------------------

- IMPROVEMENT: at end of `ase-spec-implement` skill, delete the task
- IMPROVEMENT: support `ASE_HEADLESS` mode for skipping the constitution banner under "claude -p" use by claudeX
- IMPROVEMENT: add initial GitHub Copilot CLI support to "ase setup" commands and provide marketplace/plugin JSON config files
- IMPROVEMENT: improve `ase-code-changes` skill by extending its context when necessary
- IMPROVEMENT: add support for Copilot preToolUse hook
- IMPROVEMENT: add `-t`/`--tool` option to `ase statusline` and support GitHub Copilot CLI status line
- BUGFIX: fix allowed-tools Bash pattern syntax in `ase-meta-chat` skill
- BUGFIX: omit session name in `ase statusline` output for now
- BUGFIX: "ase setup install" in development mode has to use the ASE base directory, not cwd
- BUGFIX: send logs to stderr instead of stdout to not interfere with e.g. MCP on stdin/stdout
- UPDATE: mention rudimentary GitHub Copilot CLI support in README
- CLEANUP: remove debugging leftovers in `plugin/hooks/hooks.json` and `ase-hook.ts`
- CLEANUP: fix indentation in `ase-spec-implement` skill

0.0.21 (2026-05-07)
-------------------

- IMPROVEMENT: expand and refine ase-code-lint A06/A20 with sub-aspects, severity guidance, and technology-neutral rules
- IMPROVEMENT: emit clip warning in rendered diagram and honor env-driven terminal size defaults in MCP service
- IMPROVEMENT: add evidence-grounded and contract-aware finding-report filters to skill meta rules
- BUGFIX: add health check and auto-reconnect/restart when MCP service is unavailable
- UPDATE: upgrade dependencies

0.0.20 (2026-05-04)
-------------------

- CLEANUP: switch "ase statusline" from hard-coded ANSI sequences to use of NPM package "chalk"
- IMPROVEMENT: provide a bunch of additional %x placeholders for various token, cost and Git information in "ase statusline"
- IMPROVEMENT: provide --no-icons and --no-labels options to "ase statusline"
- IMPROVEMENT: refactor "ase statusline" CLI command to support flexible expansion of information and coloring
- IMPROVEMENT: retry `claude plugin install` up to 3 times in `ase setup`
- BUGFIX: tolerate missing plugin on `ase setup uninstall` and `ase setup update`
- BUGFIX: remove unsupported Markdown formatting from `ase-spec-edit` user dialog

0.0.19 (2026-05-03)
-------------------

- IMPROVEMENT: provide "ase statusline" CLI command (factored out of claudeX sister project)

0.0.18 (2026-05-03)
-------------------

- FEATURE: add `ase-arch-analyze` skill (formerly `ase-code-audit`/`ase-code-architect`) for software architecture review
- FEATURE: switch to a new task-based (plan-mode supported) two-phase workflow
- FEATURE: add `ase task edit <id>` CLI command for task plan editing
- FEATURE: support ACCEPTED severity and clustered tradeoff reporting in arch-analyze skill
- IMPROVEMENT: extend plugin Bash allow-list (git read-only commands, analysis pipes, audit metrics)
- IMPROVEMENT: always stop the service on update and uninstall
- IMPROVEMENT: route architecture overview diagram through `ase-meta-diagram` skill
- IMPROVEMENT: polish arch-analyze skill (compactness, control-flow hint, unicode diagrams, code-based architecture detection)
- IMPROVEMENT: provide status message during operations
- IMPROVEMENT: add standalone skill hint
- REFACTOR: drop `plugin/settings.json`, move Bash allow-list into skill `allowed-tools`
- REFACTOR: restructure arch-analyze aspects (merge redundancies, split governance, render via `ase diagram`)
- BUGFIX: fix block count in arch-analyze skill (5→6)
- BUGFIX: fix typo in skill name (`ase-arch-analyse` → `ase-arch-analyze`)
- UPDATE: bump version to 0.0.18
- UPDATE: update documentation for latest changes
- CLEANUP: remove all trailing whitespaces from source files
- CLEANUP: cleanup frontmatters, setup code, and reduce text
- CLEANUP: neutralize project-specific examples in anomaly annotation rules
- CLEANUP: rename `ase-diagram` skill reference to `ase-meta-diagram`

0.0.17 (2026-05-03)
-------------------

- CLEANUP: remove unused variables except for the "boxing" (coming soon)
- CLEANUP: rename ase-meta-llm to ase-meta-chat to better fit to ase-meta-search
- IMPROVEMENT: support "ase task list|load|save|delete|purge" for task editing
- IMPROVEMENT: let persona and task be configured with ase-meta-{persona,task} and corresponding MCP tool
- IMPROVEMENT: activate persona on startup and provide user and project information initially, too
- IMPROVEMENT: ensure tools like "npm" and "claude" are found in $PATH
- IMPROVEMENT: show current and latest version on startup, with hint on available updates
- IMPROVEMENT: improve running of external commands (suppress output on success, emit on failure)
- UPDATE: document prerequisites
- CLEANUP: update documentation and improve wording for usage of plugin and tool

0.0.16 (2026-05-02)
-------------------

- IMPROVEMENT: add bin/ase{,.sh,js} bootstrapping files for developers
- IMPROVEMENT: add `ase setup install|update|uninstall` commands for convenience
- IMPROVEMENT: tighten `ase-meta-diagram` skill output to suppress extraneous text
- BUGFIX: fix the pre-tool-use hook in `plugin/hooks/hooks.json`
- UPDATE: upgrade dependencies
- CLEANUP: cleanup docs

0.0.15 (2026-05-02)
-------------------

- FEATURE: add `diagram` tool to `ase` MCP service and use it in `ase-meta-diagram` skill
- FEATURE: add `ase mcp` command which uses the `ase service` under the hood
- FEATURE: auto-install MCP service
- IMPROVEMENT: improve `ase diagram` command (TTY querying, output truncation, color mode detection)
- IMPROVEMENT: improve `ase-meta-diagram` skill (drop diagram-width option since LLM no longer renders)
- IMPROVEMENT: always allow MCP service
- BUGFIX: fix warnings on `ase service start/stop`
- UPDATE: document MCP service availability
- CLEANUP: final cleanup to diagram skill

0.0.14 (2026-05-01)
-------------------

- FEATURE: add `ase diagram` CLI subcommand that renders Mermaid source to ASCII/Unicode
- FEATURE: add `ase-meta-diagram` skill with diagram rendering rules
- BUGFIX: convert not allowed plugin/settings.json into a hook-based approach
- IMPROVEMENT: route all meta and consumer skills through `ase-diagram` skill
- UPDATE: upgrade dependencies

0.0.13 (2026-04-30)
-------------------

- FEATURE: add comprehensive `ase-arch-discover` skill

0.0.12 (2026-04-30)
-------------------

- FEATURE: add comprehensive `ase-meta-evaluate` skill
- IMPROVEMENT: improve persona skill
- IMPROVEMENT: improve explain skill
- IMPROVEMENT: use colored bullets
- BUGFIX: fix markdown
- UPDATE: provide more information about ASE
- CLEANUP: consolidate documentation in `docs/` folder
- CLEANUP: minor skill and icon cleanups

0.0.11 (2026-04-27)
-------------------

- BUGFIX: fix markdown in `/ase-meta-persona` skill
- UPDATE: document `/ase-meta-task` skill and `ase hook session-start` command

0.0.10 (2026-04-27)
-------------------

- FEATURE: add task skill (ase-meta-task) for get/set unique task id
- FEATURE: add variables for locating files in skill context
- IMPROVEMENT: allow git commands in code-changes and code-commit skills
- IMPROVEMENT: move session-start hook code into CLI as `ase hook session-start`
- IMPROVEMENT: also run session-start hook on compaction
- IMPROVEMENT: honor `ASE_TASK_ID` environment variable for task id
- IMPROVEMENT: provide more startup context information
- IMPROVEMENT: skip objective output if not given in skill
- BUGFIX: fix allowed-tools Bash pattern for ase commands in skills
- CLEANUP: add more fields to plugin and marketplace descriptors
- CLEANUP: cleanup session-start hook script
- CLEANUP: improve description of config scopes
- CLEANUP: place task config under the project for now
- CLEANUP: remove project.process.control variable (overlaps with agent.process.autonomy)
- CLEANUP: rename and clean up persona skill

0.0.9 (2026-04-22)
------------------

- FEATURE: add persona skill (ase-meta-persona)
- FEATURE: provide scoped configuration with --scope option
- FEATURE: support default values in configuration
- FEATURE: add agent configuration variables
- FEATURE: provide unique session id in session-start hook context
- IMPROVEMENT: use multi-line descriptions in skill metadata
- BUGFIX: fix Makefile path and README markup
- UPDATE: update README documentation

0.0.8 (2026-04-20)
------------------

- FEATURE: add `ase config init <type>` command
- FEATURE: add `status` and `ping` subcommands to service
- FEATURE: provide logging infrastructure with string-based log levels
- FEATURE: support edit loop in `ase config edit`
- FEATURE: support partial key paths in configuration access
- IMPROVEMENT: make daemon timer, shutdown, port handling, and service probing more robust
- IMPROVEMENT: report service uptime on `ase service status`
- IMPROVEMENT: make configuration set operation atomic
- IMPROVEMENT: improve send command, output style, and spawning portability
- IMPROVEMENT: adopt more Commander-native style and restore global `-V`/`--version` option
- IMPROVEMENT: improve table output header and rename `box` to `boxing` with classification factored out
- IMPROVEMENT: reorder commands and code blocks for better intuitiveness
- BUGFIX: avoid reading the entire logfile and fix logging format
- BUGFIX: handle incorrect log levels gracefully
- BUGFIX: resolve real paths before comparison and stop at git repository boundary
- BUGFIX: mirror `set` pattern in `delete` operation
- BUGFIX: close file descriptor leak
- BUGFIX: validate non-scalar values and intermediate node types
- BUGFIX: make exit codes consistent across commands
- BUGFIX: explicitly handle undefined values
- BUGFIX: avoid unnecessary confirmation prompts
- UPDATE: update documentation and manual pages
- CLEANUP: cleanup code, eslint config, port handling, and terminal responses
- CLEANUP: remove obsolete README and unused options
- CLEANUP: define settings and add project name

0.0.7 (2026-04-19)
------------------

- FEATURE: provide `ase config edit` command and update manual page
- FEATURE: add schema validation for configuration
- IMPROVEMENT: render `ase config list` as a nice table
- IMPROVEMENT: complain on non-leaf keys in configuration
- IMPROVEMENT: improve type safety and strictness
- REFACTOR: upgrade to Commander from Yargs and remove agent stuff for now
- REFACTOR: switch to separate arguments
- CLEANUP: cleanup `ase config` command and config handling

0.0.6 (2026-04-18)
------------------

- FEATURE: add `service` command to CLI tool
- FEATURE: add top-level configuration
- FEATURE: add new spec skills (preflight, edit, implement)
- IMPROVEMENT: improve diagramming skill with unicode character hints and if-construct support
- IMPROVEMENT: add diagram rendering rules and optional diagrams in elaborate skill
- IMPROVEMENT: clarify diagram vs. table distinction in skill output
- IMPROVEMENT: improve analyze/elaborate skills
- IMPROVEMENT: improve spec skills
- IMPROVEMENT: make code-lint skill language-agnostic
- IMPROVEMENT: do not enforce Opus model for now
- UPDATE: update dependencies
- CLEANUP: ignore `.ase` directory
- CLEANUP: various tool and main code cleanups
- CLEANUP: simplify and reformat skill information

0.0.5 (2026-04-13)
------------------

- IMPROVEMENT: add license in full text
- IMPROVEMENT: improve README with support hint and "see also" section
- IMPROVEMENT: improve quorum skill
- IMPROVEMENT: experiment with collapsed items in skills
- IMPROVEMENT: finalize commit skill
- BUGFIX: fix references in plugin skill and agent files
- BUGFIX: add missing entries to plugin configuration
- CLEANUP: cleanup and fix "npm start publish" step
- CLEANUP: align README and syntax of arguments in skill files
- CLEANUP: rename skill and agent from ase-meta-websearch to ase-meta-search

0.0.4 (2026-04-13)
------------------

- IMPROVEMENT: improved README with diagram, caution hint, and homepage URL
- IMPROVEMENT: added ase-code-commit skill
- IMPROVEMENT: added ASE logo
- IMPROVEMENT: provide GitHub release information on "npm start publish"
- BUGFIX: added missing building-blocks SVG file
- UPDATE: updated building-blocks and coding-assistance diagrams
- CLEANUP: various README and plugin skill cleanups

0.0.3 (2026-04-12)
------------------

- IMPROVEMENT: add ase-code-refactor skill

0.0.2 (2026-04-12)
------------------

- IMPROVEMENT: print version on loading

0.0.1 (2026-04-12)
------------------

- IMPROVEMENT: added Claude Code plugin infrastructure with marketplace support
- IMPROVEMENT: added CLI tool skeleton with yargs-based command structure
- IMPROVEMENT: imported lint, craft, insight, and other Claude Code skills
- IMPROVEMENT: added GitHub Pages site and static deployment workflow
- IMPROVEMENT: added top-level build infrastructure with stx integration
- IMPROVEMENT: added constitution (AGENTS.md) for agent instructions
- IMPROVEMENT: improved analysis and insight skills
- IMPROVEMENT: improved error handling and duplicate hook avoidance
- BUGFIX: fixed descriptions, references, typos, and comments
- UPDATE: inlined Andrej Karpathy coding guidelines
- UPDATE: switched from CLAUDE.md to AGENTS.md with hook-based delivery
- UPDATE: used "ase-" prefix for plugin parts consistently
- CLEANUP: various code and configuration cleanups

0.0.0 (2026-04-01)
------------------

(first rough cut of library)

