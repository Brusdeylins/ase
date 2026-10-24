
Terminology
===========

-   Definition: **Software**:<br/>
    The collection of programs (instructions) and their associated data that
    make a computer perform tasks.

-   Definition: **Software Agent**:<br/>
    **Software** that acts autonomously on behalf of a user or another program
    to achieve delegated goals. Exhibits reactivity (responds to environment),
    proactivity (goal-directed initiative), and social ability (interacts with
    other agents/users). Perceives its environment via sensors/inputs (APIs,
    files, messages, events) and acts via actuators/outputs (commands, calls,
    messages).

-   Definition: **Engineering**:<br/>
    The systematic application of scientific and technological knowledge,
    principles, approaches, practices, methods, and experiences to design,
    build, operate, and maintain solutions, up to complex production-grade
    ones, through a traceable process.

-   Definition: **Software Engineering**:<br/>
    The application of **Engineering** to the development, operation, and
    maintenance of **Software**.

-   Definition: **Artificial Intelligence (AI)**:<br/>
    The field of Computer Science focusing on building systems that perform
    tasks normally requiring human intelligence: perception, reasoning,
    learning, planning, decision-making, and language understanding. Spans
    Symbolic AI (rules, logic, search) and Machine Learning (statistical pattern
    learning from data), including Deep Learning (neural networks) and, within
    it, Generative AI (e.g. Large Language Models, or LLMs, and diffusion
    models). Operates along a spectrum from narrow AI (task-specific, e.g. image
    classifiers) to hypothetical Artificial General Intelligence (AGI) with
    general, human-level capability.

-   Definition: **Agent Harness**:<br/>
    The **Software** that surrounds an **AI** model and turns it from a passive,
    predicting model into an acting **Software Agent**. It implements a
    control loop, like ReAct (Reasoning and Acting) or Plan-and-Execute, by
    sending context to the model, interpreting its responses, executing
    requested actions, and feeding results back. It also supplies everything
    the model cannot provide itself: the tools that act as sensors and
    actuators, the assembly and management of context, and the guardrails. The
    model decides what to do; the harness determines what it can do and how it
    is carried out.

-   Definition: **AI Agent**:<br/>
    A **Software Agent** formed by an **AI** model (typically an LLM) as its
    reasoning core, operated by an **Agent Harness**.

-   Definition: **Agentic AI**:<br/>
    The paradigm of building **AI** systems out of one or more **AI Agents**
    that perceive, plan, decide, act, and adapt to pursue high-level,
    long-horizon goals with a high degree of autonomy, instead of just
    answering single prompts. Typically combines multiple specialized
    **AI Agents**, coordinated through task decomposition, orchestration, and
    shared context. Distinct from purely generative (prompt-response) AI by the
    fact that its systems take actions in the world (call APIs, run code, edit
    files, browse the web).

-   Definition: **Agentic Software Engineering**:<br/>
    **Software Engineering** following the **Agentic AI** paradigm, in which
    **AI Agents** perform multi-step tasks across the software development
    lifecycle, within a traceable process. Goes beyond inline code completion
    and chat assistants. Engineers shift toward goal specification, oversight,
    review, and governance, with human-in-the-loop gates.
