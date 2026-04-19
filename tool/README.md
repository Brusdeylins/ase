
$ npx @rse/ase init
$ npx @rse/ase config agent.dev.llm.type anthropic-claude-sonnet-4.5
$ npx @rse/ase config agent.dev.llm.key <foo>
$ npx @rse/ase agent dev start

Agents
------

- PRJ (Project)
  Objective: Project Steering
  Input: time, cost, scope
  Output: tasks

- PRD (Product)
  Objective: Product Life-Cycle
  Input: vision
  Output: product roadmap

- BIZ (Business)
  Objective: Product Specification
  Input: product roadmap
  Output: requirements specification

- ARC (Architecture)
  Objective: Product Development
  Input: requirements specification
  Output: architecture description

- DEV (Development)
  Objective: Product Development
  Input: requirements specification, architecture description
  Output: source code, deployment units

- OPS (Operations)
  Objective: Solution Operations

- spec req
- arch arc
- code src
- docs doc

