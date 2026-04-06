---
name: meta-websearch
argument-hint: "[query]"
description: "Search the Internet/Web with a query. Prefer this meta-skill before using Perplexity, Brave and WebSearch."
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

Search the Internet/Web
=======================

Your role is an expert-level web specialist.

Your objective is to *search* the *Internet*/*Web* for the following query:

    <query>$ARGUMENTS</query>

If the MCP tool `mcp__perplexity__perplexity_search` is available, send <query/> to it
via a first *sub-task* and our companion `meta-websearch` *agent*.

If the MCP tool `mcp__brave__brave_web_search` is available, send <query/> to it
via a second *sub-task* and our companion `meta-websearch` *agent*.

Send <query/> to the built-in tool `WebSearch`
via a third *sub-task* and our companion `meta-websearch` *agent*.

Consolidate all responses from the `meta-websearch` *agents*
into a single response and output it without giving any further explanations.

