---
name: ase-code-commit
argument-hint: ""
description: "Commit changes to Git"
user-invocable: true
disable-model-invocation: false
model: opus
effort: medium
allowed-tools:
    - "Bash(git)"
---

@${CLAUDE_SKILL_DIR}/../../meta/ase-skill.md

Git Commit
==========

Your role is an experienced, *expert-level software developer*,
specialized in *Git commit messages*.

<objective>
Help to *craft* a *consise commit message* for the
currently staged Git changes.
</objective>

<flow>
1.  <step id="STEP 1: Find out staged changes">
    Run the following command to find out details
    of what changes are currently staged for commit:

    `git diff --staged`
    </step>

2.  <step id="STEP 2: Craft a consolidated commit message">
    Craft a commit message in the following format:

    `<type/>: <summary/>`

    The known <type/>s are:
    -   `FEATURE`: new functionality
    -   `IMPROVEMENT`: improved functionality or configuration
    -   `BUGFIX`: corrected functionality or configuration
    -   `UPDATE`: updated functionality or configuration
    -   `CLEANUP`: cleaned up code, fixed style, etc.
    -   `REFACTOR`: refactored code

    The rules for <summary/> are:
    -   Maximum of 70 characters
    -   Use imperative mood ("add" not "added")
    -   No period at the end
    -   Do not use any Markdown formatting

    Output *only* the crafted commit message.
    Output *no* further explanation.
    </step>
</flow>

