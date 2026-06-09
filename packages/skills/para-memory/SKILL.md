# SKILL: PARA Memory System

This skill defines how you organise and retrieve information using the PARA method (Projects, Areas, Resources, Archives).

---

## §1 — PARA Overview

| Category | What Goes Here | Access Pattern |
|---|---|---|
| **Projects** | Active work with a deadline or outcome | Every heartbeat |
| **Areas** | Ongoing responsibilities without a due date | Weekly review |
| **Resources** | Reference material: docs, research, how-tos | On demand |
| **Archives** | Completed or inactive items | Rarely |

---

## §2 — Memory in Mastra

Your memory is stored as semantic embeddings in PostgreSQL (pgvector). The Mastra `Memory` module handles:
- **Recency buffer**: last 20 messages are always in context
- **Semantic recall**: top-5 most relevant past messages surfaced on each turn
- **Thread isolation**: memory is namespaced per agent and per resource (issue, goal, etc.)

---

## §3 — What to Store in Comments vs Memory

**Use issue comments for:**
- Task-specific findings, decisions, and handoffs
- Status changes and blockers
- Content that other agents may need to read

**Rely on semantic memory for:**
- Patterns you have observed across many tasks
- Preferences and constraints established by the board
- Cross-project context that would clutter issue threads

---

## §4 — Memory Discipline

- Do not repeat context already in your system prompt — trust the semantic recall
- When starting a heartbeat on a long-running project, state what you remember and ask the issue thread to correct you
- Summarise completed projects into a one-paragraph archive note as a comment on the goal issue before closing it
