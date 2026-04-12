---
name: ase-meta-llm
argument-hint: "<llm> <query>"
description: "Query foreign LLM. Use this skill if a foreign LLM like OpenAI ChatCGPT, Google Gemini, DeepSeek or xAI Grok should be queried."
user-invocable: true
disable-model-invocation: false
context: fork
model: opus
effort: low
allowed-tools:
    - "mcp__perplexity__perplexity_search"
    - "mcp__brave__brave_web_search"
    - "WebSearch"
    - "WebFetch"
---

Query Foreign LLMs
==================

Your role is to act as a proxy to query a foreign LLM.

CONFIG
------

Through corresponding *MCP servers*,
you might have the following foreign LLMs available:

- **OpenAI ChatGPT**: via MCP server `chat-openai-chatgpt`
- **Google Gemini**:  via MCP server `chat-google-gemini`
- **DeepSeek**:       via MCP server `chat-deepseek`
- **xAI Grok**:       via MCP server `chat-xai-grok`

PLAN
----

Follow the following plan:

1. Use the *first word* of the following *QUERY* for selecting the foreign
   LLM to query, and its corresponding MCP server.

2. Spawn a *sub-task* with the `ase-meta-llm` *agent* for the selected foreign LLMs,
   and pass the *second and all remaining* words of the following *QUERY*
   as the query for the selected LLM.

3. Return the *plain response* of the `ase-meta-llm` agent 1:1 and *without any
   modifications*. Especially, do NOT add or remove any text from the agent
   response on your own and do not interpret the result in any way.

QUERY
-----

$ARGUMENTS

