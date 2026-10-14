# ase-setup-mcp(1) -- Manage the Pre-Defined Foreign MCP Servers

## SYNOPSIS

`ase setup mcp`
\[`-h`|`--help`\]

`ase setup mcp list`
\[`-h`|`--help`\]

`ase setup mcp activate`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]
\[`-s`|`--scope` *scope*\]
\[*servers*\]

`ase setup mcp deactivate`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]
\[`-s`|`--scope` *scope*\]
\[*servers*\]

## DESCRIPTION

**ase setup mcp** manages the pre-defined *foreign MCP servers* which
*ASE* skills can *optionally* leverage for improved quality: the
*chat* servers (leveraged by the skills `ase-meta-chat` and
`ase-meta-quorum`) and the *search* servers (leveraged by the skills
`ase-meta-search`, `ase-meta-evaluate`, and `ase-arch-discover`).
Without a sub-command, the usage information is shown and the command
exits with status `1`.

The currently pre-defined servers are (by their *id*, followed by the
registered MCP server name):

- `openai-chatgpt` (`chat-openai-chatgpt`):
  *OpenAI ChatGPT*, key `ASE_MCP_KEY_OPENAI_CHATGPT` or
  `ASE_MCP_KEY_OPENROUTER`.

- `google-gemini` (`chat-google-gemini`):
  *Google Gemini*, key `ASE_MCP_KEY_GOOGLE_GEMINI` or
  `ASE_MCP_KEY_OPENROUTER`.

- `deepseek` (`chat-deepseek`):
  *DeepSeek*, key `ASE_MCP_KEY_DEEPSEEK` or `ASE_MCP_KEY_OPENROUTER`.

- `xai-grok` (`chat-xai-grok`):
  *xAI Grok*, key `ASE_MCP_KEY_XAI_GROK` or `ASE_MCP_KEY_OPENROUTER`.

- `alibaba-qwen` (`chat-alibaba-qwen`):
  *Alibaba Qwen*, key `ASE_MCP_KEY_ALIBABA_QWEN` or
  `ASE_MCP_KEY_OPENROUTER`.

- `zai-glm` (`chat-zai-glm`):
  *Z.AI GLM*, key `ASE_MCP_KEY_ZAI_GLM` or `ASE_MCP_KEY_OPENROUTER`.

- `anthropic-claude` (`chat-anthropic-claude`):
  *Anthropic Claude* via the locally installed *Anthropic Claude Code
  CLI*, variable `ASE_MCP_KEY_ANTHROPIC_CLAUDE`.

- `openai-codex` (`chat-openai-codex`):
  *OpenAI Codex* via the locally installed *OpenAI Codex CLI*,
  variable `ASE_MCP_KEY_OPENAI_CODEX`.

- `github-copilot` (`chat-github-copilot`):
  *GitHub Copilot* via the locally installed *GitHub Copilot CLI*,
  variable `ASE_MCP_KEY_GITHUB_COPILOT`.

- `brave` (`search-brave`):
  *Brave* search, key `ASE_MCP_KEY_BRAVE`.

- `perplexity` (`search-perplexity`):
  *Perplexity* search, key `ASE_MCP_KEY_PERPLEXITY`.

- `exa` (`search-exa`):
  *Exa* search, key `ASE_MCP_KEY_EXA`.

The API-based *chat* servers are registered as stdio servers running
`npx -y mcp-to-openai`, which bridges to the OpenAI-compatible API of
the LLM vendor, or, with the key `ASE_MCP_KEY_OPENROUTER` of an
*OpenRouter* account as a common alternative, to the *OpenRouter*
proxy API. The harness-based *chat* servers (`anthropic-claude`,
`openai-codex`, and `github-copilot`) are registered as stdio servers
running `npx -y mcp-to-harness`, which bridges to the locally
installed agent tool CLI, authenticating via its own configured
credentials: their variable carries no API key at all, but the model
identifier of the harness, with the special value `default` selecting
the default model of the harness. The *search* servers are registered
as stdio servers running `npx -y @brave/brave-search-mcp-server` resp.
`npx -y @perplexity-ai/mcp-server`, resp. as an HTTP server on
`https://mcp.exa.ai/mcp` for `exa`.

## COMMANDS

- `ase setup mcp list`:
  List all pre-defined MCP servers known to *ASE*, rendered as a
  table with the columns `ID` (the server id), `NAME` (the service
  name), `VERS` (the pinned model version, or `latest`), `MCP` (the
  registered MCP server name), `KEY` (the accepted suffixes *KEY* of
  the environment variables `ASE_MCP_KEY_`*KEY*, in order of
  preference), and `SKILLS` (the *ASE* skills leveraging the server).
  It accepts no options besides `-h`|`--help` and does not require any
  agent tool.

- `ase setup mcp activate` \[`-t`|`--tool` *tool*\] \[`-s`|`--scope` *scope*\] \[*servers*\]:
  Register one or more pre-defined MCP servers with the agent tool
  (via `<cli> mcp add`). The environment variables
  `ASE_MCP_KEY_`*KEY* are first additionally sourced from a `.env`
  file in the current directory (if existing). Each selected server
  takes its key from the first of its variables (see `KEY` of `ase
  setup mcp list`) which is set and non-empty. A server none of whose
  variables is set is silently skipped when it was selected
  implicitly (via an empty *servers* or `all`), but causes a hard
  error when it was given explicitly. A prior registration of the
  same server is removed first, so it is re-created cleanly.

- `ase setup mcp deactivate` \[`-t`|`--tool` *tool*\] \[`-s`|`--scope` *scope*\] \[*servers*\]:
  Unregister one or more pre-defined MCP servers from the agent tool
  (via `<cli> mcp remove`). A server which is not currently
  registered is skipped. No API keys are required.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\] (`activate` and `deactivate` only):
  Select the target agent tool: `claude`, `copilot`, or `codex`
  (default: `$ASE_TOOL`, else `claude`). Its CLI has to be found in
  `$PATH`.

- \[`-s`|`--scope` *scope*\] (`activate` and `deactivate` only):
  Select the MCP server registration scope: `user` (default;
  registered globally for the current user), `project` (registered in
  the project and meant to be shared via version control), or `local`
  (registered in the project, but kept out of version control). The
  scope is always passed explicitly to *Anthropic Claude Code CLI*, as
  it would otherwise default to `local`. Only supported for `--tool
  claude`; a non-`user` scope for `copilot` or `codex` fails with an
  error.

## ARGUMENTS

- \[*servers*\] (`activate` and `deactivate` only):
  A comma-separated list of server ids (see above). When omitted,
  empty, or given as the literal `all`, every pre-defined server is
  selected. An unknown server id fails with an error listing all
  known ids.

## ENVIRONMENT

- `ASE_MCP_KEY_`*KEY*:
  The API key (resp., for the harness-based servers, the harness model
  identifier or `default`) of the pre-defined MCP servers, where *KEY*
  is one of the suffixes shown in the `KEY` column of `ase setup mcp
  list`, e.g., `ASE_MCP_KEY_OPENAI_CHATGPT` for `openai-chatgpt`. The
  key is passed to the registered server (e.g., as its environment
  variable `OPENAI_KEY`, `BRAVE_API_KEY`, or `PERPLEXITY_API_KEY`) and
  masked in the logged commands.

- `ASE_MCP_KEY_OPENROUTER`:
  The *OpenRouter* API key, accepted by all API-based *chat* servers
  as an alternative to the native API key of the LLM vendor.

- `ASE_TOOL`:
  The default of `--tool`.

## FILES

- `.env`:
  An optional file in the current directory, from which the
  `ASE_MCP_KEY_`*KEY* variables are additionally sourced on `ase setup
  mcp activate`.

## EXIT STATUS

`0` on success, `1` on any error (and when invoked without a
sub-command).

## EXAMPLES

```sh
# list all pre-defined MCP servers
$ ase setup mcp list

# activate all servers whose keys are available
$ ase setup mcp activate

# activate two search servers for the current project only
$ ASE_MCP_KEY_BRAVE=... ASE_MCP_KEY_EXA=... \
  ase setup mcp activate --scope project brave,exa

# activate the harness-based Anthropic Claude server with its default model
$ ASE_MCP_KEY_ANTHROPIC_CLAUDE=default ase setup mcp activate anthropic-claude

# deactivate all servers in GitHub Copilot CLI
$ ase setup mcp deactivate --tool copilot all
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-status`(1), `npx`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
