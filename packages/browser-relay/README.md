# @oh-my-pi/browser-relay

<<<<<<< HEAD
Chrome extension that lets storoslop's Eval `browser` API drive **your existing Chrome tabs** — logged-in sessions included — without relaunching Chrome with `--remote-debugging-port` (which Chrome 136+ refuses on the default profile anyway).

The companion relay server lives in the storoslop CLI (`storoslop browser-relay`, see `packages/coding-agent/src/tools/browser/relay/`). It impersonates Chrome's CDP discovery endpoint, synthesizes the browser target and `Target.*` hierarchy that `chrome.debugger` doesn't expose, and multiplexes any number of downstream puppeteer connections (storoslop opens one per tab worker) over the single debugger attachment Chrome allows per tab.

## Setup

1. `storoslop browser-relay install` — writes the bundled extension to `~/.storoslop/browser-relay/extension`, then load it via `chrome://extensions` → Developer mode → _Load unpacked_. (Or grab `omp-browser-relay-extension.zip` from GitHub releases.)
2. Opt in, one of two ways:
   - **Per call** — pass `app: { relay: true }` to `browser.open(...)` in Eval. Works without any setting and persists nothing: the configured default for every other call and session stays whatever it already was.
   - **As the default** — `storoslop config set browser.relay true` makes the relay the default for **every session using this profile, in every project** (project-level settings, `PI_BROWSER_RELAY`, and an explicit `app` choice still take precedence). Any session's ordinary `browser.open(...)` call will then drive your real browser — including background sessions you aren't watching; without `app.target` such a call opens its own background tab in your logged-in profile.

That's it: the relay server auto-starts under storoslop's profile-independent global daemon broker the first time Eval's browser API needs it. Every relay consumer holds a broker lease, so one project exiting cannot interrupt another; the server stops after the last consumer across all projects exits. The extension badge turns **on** when connected. Run `storoslop browser-relay` manually only for `--token`, `--no-group`, or a non-default port — a relay already serving the port is adopted, never fought over.

`app.target` borrows a specific tab by URL/title substring; without it, storoslop opens its own tab in the background, leaving your selected tab and focus alone, and closes it when the storoslop tab is closed (an extension installed by an older storoslop selects that tab instead; re-run `storoslop browser-relay install` and reload it). Tabs storoslop is **actively driving** are gathered into a per-window **"omp" tab group** (cyan) — released when storoslop lets go of the tab and dissolved on disconnect; the rest of your tabs, pinned tabs, tabs in your own groups, and tabs you drag out are left alone. Disable with `storoslop browser-relay --no-group`.

After a storoslop upgrade, the relay keeps the extension current on its own: when it meets an extension older than itself that Chrome loaded from `~/.storoslop/browser-relay/extension`, and no storoslop session is connected to the relay and none of the extension's tabs is attached, it rewrites the files there and asks the extension to reload. Chrome re-reads them under the same extension id, keeping its settings, permissions and the _Allow access to file URLs_ choice; the badge goes off and on. Otherwise run `storoslop browser-relay install` (with your `--dir`) and click _Reload_ in `chrome://extensions`: after every upgrade for an extension loaded from another folder, once for one installed before storoslop could update it. A Chrome restart is not enough, as Chrome keeps running the worker it loaded; a relay `browser.open` notes when the loaded extension came from an older storoslop.

## Development

- `bun run build` — bundles the extension into `dist/extension/`, zips it for GH releases, and regenerates the embedded CLI install assets under `packages/coding-agent/src/tools/browser/relay/extension-assets/` (**commit those**).
- `bun scripts/smoke.ts [relay-url] [target-substring]` — end-to-end smoke replicating storoslop's supervisor + tab-worker double-connection pattern against a live relay.
=======
The **omp** extension puts omp in the Chrome side panel. It also lets omp's Eval `browser` API drive **your existing Chrome tabs** — logged-in sessions included — without relaunching Chrome with `--remote-debugging-port`.

The extension's native host binds an OS-assigned loopback port and publishes it for local terminal clients to discover. The relay translates CDP to `chrome.debugger`.

Sidebar-owned chats carry browser commands on the same native messaging port as chat. Their native host gives omp a per-chat loopback CDP endpoint on an OS-assigned port. Existing terminal sessions joined through collab keep their own browser configuration.

## Setup

1. Run `omp browser-relay install` to write the omp extension and register its native host. The command also adds the extension to the Chrome profile you used last, by writing Chrome's own unpacked-install record (location, permissions, HMAC and OSCrypt authenticators); a running Chrome is restarted around the write, so no click is needed. Use `--profile <name>` to pick another profile. If the profile cannot be written (or with `--no-chrome`), it prints the manual steps instead: turn on Developer mode in `chrome://extensions`, choose _Load unpacked_, and select the directory it printed. The files are also available as `omp-browser-relay-extension.zip` in GitHub releases; the CLI install is still needed to register the native host for new panel sessions.
2. Click omp in the toolbar or press Cmd+E (Ctrl+E outside macOS) to open the panel. Start a new session in a directory or attach to a terminal session that is hosting a collab room (`/collab`, or set `collab.autoStart` to `control`). The panel can send screenshots and element picks, record workflows with Teach, and schedule saved shortcuts even while the panel is closed. A panel session's browser is your Chrome alone: every tab Eval's `browser.open` opens (subagents' included) appears in your window, and omp never starts a browser of its own there.
3. To drive Chrome from Eval outside the panel, opt in one of two ways:
   - **Per call** — pass `app: "relay"` to `browser.open(...)` in Eval. Works without any setting and persists nothing: the configured default for every other call and session stays whatever it already was.
   - **As the default** — `omp config set browser.relay true` makes the relay the default for **every top-level session using this profile, in every project** (project-level settings, `PI_BROWSER_RELAY`, and an explicit `app` choice still take precedence). Any such session's ordinary `browser.open(...)` call will then drive your real browser, including `omp -p` runs and other background sessions you aren't watching; without `target` such a call opens its own background tab in your logged-in profile. Subagents skip the default (and `PI_BROWSER_RELAY=1`) and reach the relay only with `app: "relay"`.

That's it: nothing needs starting. The relay is up whenever Chrome runs with the extension, and the extension badge shows **on** while it is. A relay served by an older omp keeps running across `omp update`; the first browser call from a newer omp asks it to restart, and Chrome starts the next native host from the installed omp. To drive your browser from omp on another machine, forward the discovered local port with SSH and set `browser.relayUrl` on the remote machine.

`target` borrows a specific tab by target ID or URL/title substring; without it, omp opens its own tab in the background, leaving your selected tab and focus alone, and closes it when the omp tab is closed. Tabs omp is **actively driving** are gathered into a per-window **"omp" tab group** (cyan) — released when omp lets go of the tab and dissolved on disconnect; the rest of your tabs, pinned tabs, tabs in your own groups, and tabs you drag out are left alone.

### Updates

Loading the folder the first time is the one step that stays manual: Chrome gives programs no way to add an unpacked extension to a profile. `omp browser-relay install` checks every Chrome, Chromium and Brave profile on the machine. It prints that step only when no profile has the folder loaded, and skips the Developer mode part when a profile already has it on.

After that, updates need no action. omp keeps registered folders current: `omp update`, the first launch of a new version or rebuilt source checkout, `install`, and `omp browser-relay sync` all rewrite them. Each write asks the running relay to recheck. When the extension runs a different build from the one in its folder, the relay reloads it once it is idle. A relay newer than the extension also rewrites the folder itself. Chrome keeps the extension's ID, settings and _Allow access to file URLs_ through the reload because the ID comes from the folder path; the manifest deliberately carries no `key`. Run `omp browser-relay install --dir <folder>` once for any custom unpacked directory that isn't registered yet. That also adds the folder's ID to the native host's allowed origins.

## Development

- `bun run build` (after `bun install --frozen-lockfile` at the repository root) bundles the extension into `dist/extension/`, zips it for GitHub releases, and regenerates the CLI's embedded copy, `packages/coding-agent/src/tools/browser/relay/extension.generated.json`.
- That copy is generated, not committed. `bun install` (root `prepare`) writes it for source checkouts; run `bun run gen:relay-extension` after changing the extension, and the next `omp` launch rewrites registered extension folders. Binary and npm builds embed a fresh build themselves. A checkout without it still starts; only `omp browser-relay install`/`sync` fail, naming the command.
- `bun scripts/smoke.ts [relay-url] [target-substring]` — end-to-end smoke replicating omp's supervisor + tab-worker double-connection pattern against a live relay.
>>>>>>> upstream/main

## Limitations

- `chrome://`, DevTools, Web Store, and other-extension pages are not attachable and are hidden from the agent.
- Chrome shows its "is debugging this browser" infobar while any tab is attached; dismissing it detaches that tab until it navigates again.
- A tab with DevTools open can't be attached (one debugger per tab — the constraint the relay multiplexes around for its own clients).
- Chrome refuses the debugger in a tab while another extension's frame, such as a password manager's inline menu, is in it. In a tab omp drives, the extension empties and hides that frame so storoslop can continue; your other tabs keep theirs. The call that ran into the frame, or a later one on that tab, names the extension and the frame's page, so the agent can tell you what was hidden.
- Anything that can reach the relay port can drive your logged-in browser. The relay binds loopback only; use `storoslop browser-relay --token <secret>` (mirrored in the extension options) if untrusted local processes are a concern.
