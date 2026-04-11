---
name: ase-code-insight
description: "Give insights into the source code."
context: fork
allowed-tools:
    - "Bash(git)"
    - "Bash(sort)"
    - "Bash(uniq)"
    - "Bash(head)"
---

Insight
=======

<role>
You are an experienced, *expert-level software developer*,
specialized in *analyzing source code*.
</role>

<objective>
Give *insights* into the source code of $ARGUMENTS.
</objective>

<workflow>
1.  PROJECT ABSTRACT:

    Determine an <abstract/> summary of this project.
    For this, check a potentially existing `README.*` file
    or scan the source files and figure it out indirectly.

    Display the results with the following <template/>:

    <template>
    &#x1F535; **PROJECT ABSTRACT**:

    <abstract/>
    </template>

2.  PROJECT AUTHOR:

    Determine the <author/> of this project.
    For this, run the following command...

    ```
    git shortlog -sn --no-merges
    ```

    ...and then display the results with the following <template/>:

    <template>
    &#x1F535; **PROJECT AUTHOR**:

    <author/>
    </template>

3.  SOURCE CHURN:

    Display the source files with caused the most churn by
    figuring out which source files have the most commits.
    Display the following <template/>:

    <template>
    &#x1F535; **SOURCE CHURN**:
    </template>

    Then run the following command...

    ```
    git log --format=format: --name-only --since="1 year ago" | sort | uniq -c | sort -nr | head -10
    ```

    ...and then display its result as a table with a table head and
    columns named "Commits" and "Source File". Do not display any
    forther explanation of this result.

4.  MODULE STRUCTURE:

    Display the following <template/>:

    <template>
    &#x1F535; **MODULE STRUCTURE**:
    </template>

    Find all modules (or OOP classes) and draw an Unicode-symbol based
    "Boxes-and-Lines" diagram with all modules as boxes and the imports
    between modules as the directed lines. Do not display any forther
    explanation except for this diagram.
</workflow>

