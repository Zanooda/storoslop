# hello-extension

A minimal `storoslop` extension that demonstrates the two most common authoring patterns: subscribing to `session_start` to notify on load, and registering a `/hello` slash command that sends a greeting into the conversation. It is intentionally small — use it as a copy-paste starting point for your own extension.

## Install

**Option A — drop into user extensions directory:**

```
cp -r . ~/.storoslop/agent/extensions/hello-extension
```

Restart `storoslop`. You will see the startup notification immediately.

With `storoslop --profile <name>`, use `~/.storoslop/profiles/<name>/agent/extensions/hello-extension` instead. `PI_CODING_AGENT_DIR` likewise changes the agent directory.

**Option B — point the settings `extensions` array at it:**

```yaml
# ~/.storoslop/agent/config.yml
extensions:
  - /path/to/hello-extension
```

**Option C — load once via CLI flag:**

```
storoslop --extension ./hello-extension
```

## Usage

After loading, type `/hello` or `/hello Ada` in the storoslop prompt. The command sends a visible greeting custom message into the conversation and shows a "Message sent!" notification.

## What it demonstrates

- Default export factory receiving `ExtensionAPI`
- `pi.on("session_start", ...)` — session lifecycle hook
- `pi.registerCommand(...)` — slash command registration
- `ctx.ui.notify(...)` — user-facing notification
- `package.json` with `omp.extensions` manifest field
