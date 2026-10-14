# ase-hook-pre-tool-use(1) -- Handle the PreToolUse Hook Event

## SYNOPSIS

`ase hook pre-tool-use`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook pre-tool-use** handles the `PreToolUse` hook event of
*Anthropic Claude Code CLI* and *OpenAI Codex CLI*, resp. the
`preToolUse` hook event of *GitHub Copilot CLI*, which the agent tool
fires before each tool invocation. It is intended to be invoked by the
agent tool internally as a configured hook handler only, and not
directly by end users.

The handler reads the event payload from standard input, a JSON object
with the tool name (field `tool_name`, resp. `toolName` for *GitHub
Copilot CLI*), the tool input (field `tool_input`, resp. `toolArgs`,
either an object or a JSON-encoded string), and the session id (field
`session_id`, resp. `sessionId`). It auto-approves the invocation, so
the user is not prompted for it, if it is one of the following:

- a shell command (tool `Bash`, resp. `bash`) starting with the word
  `ase` and not containing any of the characters `;`, `&`, `|`, `<`,
  `>`, backtick, or newline, or a `$(` command substitution;

- a skill invocation (tool `Skill`) of an *ASE* skill (`ase-`*name*,
  optionally namespaced as `ase:ase-`*name*);

- an *ASE* MCP tool (`mcp__plugin_ase_ase__`*tool* for `claude`,
  `ase-`*tool* for `copilot`, and `mcp__ase__`*tool* for `codex`);

- a tool of one of the pre-defined foreign MCP servers of `ase setup
  mcp` (`chat-alibaba-qwen`, `chat-deepseek`, `chat-google-gemini`,
  `chat-openai-chatgpt`, `chat-xai-grok`, `chat-zai-glm`,
  `search-brave`, `search-exa`, and `search-perplexity`, named
  `mcp__`*server*`__`*tool* resp. *server*`-`*tool* for `copilot`);

- a file read (tool `Read`) of a file located below the plugin root
  directory (e.g., the meta files included by the skills);

- a file edit (tool `Edit`) while one of the edit-capable skills
  `ase-code-lint`, `ase-docs-shorten`, `ase-docs-refine`, or
  `ase-docs-proofread` is recorded as active in the internal session
  state of the session.

On approval, the handler writes the decision `permissionDecision:
allow` with a human-readable `permissionDecisionReason` to standard
output, nested in `hookSpecificOutput` (`claude`), resp. as top-level
fields (`copilot`). Otherwise, it stays silent and hence defers to the
regular permission flow of the agent tool.

For `--tool codex`, the handler only drains its standard input and
stays silent, as *OpenAI Codex CLI* rejects an approval in
`PreToolUse`; the approval is granted by `ase hook permission-request`
instead.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  The agent tool whose event payload is read and whose decision format
  is written: `claude`, `copilot`, or `codex`. Default: `$ASE_TOOL`,
  else `claude`.

## ENVIRONMENT

- `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`, `PLUGIN_ROOT`:
  The plugin root directory for the auto-approval of plugin file
  reads. If unset, such reads are not auto-approved.

- `ASE_TOOL`:
  The default of `--tool`.

## FILES

- *per-user state directory*`/session/`*id*`/state.yaml`:
  The internal session state, whose `skill` field records the active
  edit-capable skill.

## EXIT STATUS

Exits with status `0`, unless `--tool` is invalid (status `1`).

## SEE ALSO

`ase`(1), `ase-hook`(1), `ase-hook-permission-request`(1),
`ase-setup-mcp`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
