`memory` is the always-on file-based memory for the storoslop agent: a plain-markdown store of durable facts and decisions kept under `~/.storoslop/memory/`. It is intentionally separate from the `memory.backend` pipeline (`off` by default): this tool always works, has no background LLM consolidation, and costs nothing unless you call it.

Use **proactively** like Claude Code: when the user states a durable preference, convention, or decision, save it with `write`; at the start of relevant work, `recall` global + current-repo memory; remove outdated rules with `forget`.

- `write`: save a short fact to the current repository's memory (`scope: project`) or cross-repo memory (`scope: global`). Writes append a dated bullet and are echoed back.
- `recall`: read saved memory. Returns the current project's memory plus global memory (middle-truncated; recent entries kept). Call before assuming something that was settled earlier.
- `forget`: remove entries whose text contains `match`.
- `status`: report where memory is stored and which project scope applies.

Memory is keyed per repository by its git `origin` (`owner/repo`), falling back to a path hash outside git. Files are human-readable and editable: `<home>/.storoslop/memory/MEMORY.md` (global) and `<home>/.storoslop/memory/projects/<owner>/<repo>/MEMORY.md` (project). Override the root with `STOROSLOP_MEMORY_DIR`. Memory is never written inside the project.
