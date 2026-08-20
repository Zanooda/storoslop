# memory

> Always-on file-based memory (Claude-Code style): durable facts and decisions stored as plain markdown under `~/.storoslop/memory/`, with a **global** store plus a **per-project** store.

## Source

- Entry: `packages/coding-agent/src/tools/memory.ts`
- Storage: `packages/coding-agent/src/memory-files/paths.ts` + `store.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/memory.md`

## Storage layout

| Scope | Path |
|---|---:|
| Global | `~/.storoslop/memory/MEMORY.md` |
| Project | `~/.storoslop/memory/projects/<owner>/<repo>/MEMORY.md` |

- **Global** memory is cross-repository; **project** memory is keyed by the repository's git `origin` (`owner/repo`), with a short path-hash fallback outside git.
- Override the root with `STOROSLOP_MEMORY_DIR`. Memory is never written inside the project directory.
- Files are human-readable, dated-bullet markdown. Reads are middle-truncated (recent entries kept).

## Registration / Visibility

- Tool metadata: `approval = "write"`, `strict = true`, `loadMode = "discoverable"`.
- Always available — independent of `memory.backend` (works with `"off"`). Pairs with the environment's ambient injection of global + project memory.
- Execution is synchronous, single-shot.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `op` | `"recall" \| "write" \| "forget" \| "status"` | Yes | Operation. |
| `scope` | `"project" \| "global"` | No | Default `project` for write/forget; `recall` returns both. |
| `entry` | `string` | For `write` | Durable fact to remember. |
| `match` | `string` | For `forget` | Substring; matching lines are removed. |

## Outputs

- `content[0].type = "text"`
- `write` echoes the resulting memory on success.
- `recall` returns project + global memory, or `No saved memory yet.`
- `forget` reports how many entries were removed.
- Failures return `isError` with the message.
