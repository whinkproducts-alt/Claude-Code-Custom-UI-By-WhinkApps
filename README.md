# Claude Chats

A small local web page for [Claude Code](https://claude.com/claude-code). It lists every chat Claude Code has saved on this computer, groups them into projects and folders, and lets you continue any chat or start a new one. It works with whatever models Claude Code is set up to use, including a gateway such as OmniRoute.

No database, no build step, no dependencies. Plain Node.

## Start here

| I want to… | Go to |
|---|---|
| Use it on my own Mac or Windows PC | [Pick your computer](#pick-your-computer) below |
| Set it up on my second computer | [docs/NEW-PC.md](docs/NEW-PC.md) |
| Have Claude set it up on someone else's computer | [docs/PASTE-INTO-CLAUDE.md](docs/PASTE-INTO-CLAUDE.md) |
| Get my own free-first gateway with my own keys | [docs/OMNIROUTE-CLONE.md](docs/OMNIROUTE-CLONE.md) |
| Use a different or backup LLM | [docs/PUBLIC-GATEWAYS.md](docs/PUBLIC-GATEWAYS.md) |

This project contains **no models and no keys**. You bring your own.

## Pick your computer

| | |
|---|---|
| 🍎 **Mac** | [Install on Mac](#-install-on-mac) |
| 🪟 **Windows** | [Install on Windows](#-install-on-windows) (written but **not yet tested on a real Windows PC**) |

Everything Mac-only lives in the [`mac/`](mac) folder and everything Windows-only in [`windows/`](windows). Nothing else in the repo depends on your system.

**Download the code first** (if you were given a private link, sign in to GitHub first):

- On the GitHub page: click the green **Code** button, then **Download ZIP**, and unzip it.
- Or in a terminal: `gh repo clone whinkproducts-alt/Claude-Code-Custom-UI-By-WhinkApps` (needs `gh auth login` once).

---

## 🍎 Install on Mac

Open Terminal in the downloaded folder.

**One command does everything below** (installs what is missing and puts the launcher on your Desktop):

```bash
sh mac/setup.sh
```

Or step by step:

**1. Install what it needs** (git, Node.js 20+, Claude Code, GitHub CLI; skips what you have):

```bash
sh mac/install.sh
```

It needs [Homebrew](https://brew.sh); if that is missing, the script prints the one command to install it. After a fresh Claude Code install, run `claude` once and sign in.

**2. Make the app icon:**

```bash
sh mac/build-launcher.sh
```

This creates **Claude Chats** in your `Applications` folder (inside your home folder) with the Whink logo and a Claude badge. Double-click it to open the page; it starts the server first if needed. Drag it to your Dock to keep it there. The Claude badge is copied from your installed Claude app, so the Claude artwork is not stored in this repo; without that app you get the Whink logo alone.

**3. Optional, always on:** `sh mac/autostart.sh install` starts it at every login and restarts it if it stops. `status` and `remove` also work. The agent runs the Node on your PATH at install time, so run `install` again after upgrading Node with a version manager. The log is `~/.claude-local-ui/server.log`.

**By hand instead:**

```bash
brew install git node gh
curl -fsSL https://claude.ai/install.sh | bash     # Claude Code, then run: claude
brew install --cask tailscale-app                      # optional
node server.js                                     # then open http://127.0.0.1:3030
```

`sh mac/install.sh --with-tailscale` installs Tailscale too.

---

## 🪟 Install on Windows

> **Not tested on a real Windows PC yet.** The scripts follow Microsoft's and Anthropic's documented install steps, but expect to fix small things. Tell us what breaks.

Open **PowerShell** in the downloaded folder (Windows 10 or 11).

**One command does everything below** (installs what is missing and puts the shortcut on your Desktop):

```powershell
powershell -ExecutionPolicy Bypass -File windows\setup.ps1
```

Or step by step:

**1. Install what it needs** (Git, Node.js 20+, Claude Code, GitHub CLI; skips what you have):

```powershell
powershell -ExecutionPolicy Bypass -File windows\install.ps1
```

Then **close the window and open a new PowerShell**, so the new programs are found. After a fresh Claude Code install, run `claude` once and sign in.

**2. Make the desktop shortcut:**

```powershell
powershell -ExecutionPolicy Bypass -File windows\build-launcher.ps1
```

This puts **Claude Chats** (Whink logo) on your Desktop. Double-click it to open the page; it starts the server first if needed. Right-click it and choose **Pin to taskbar** to keep it there. (The Claude badge on the Mac icon comes from the Mac Claude app, so the Windows icon is the Whink logo alone.)

**3. Optional, start at login:** `powershell -ExecutionPolicy Bypass -File windows\autostart.ps1 install` (also `status` and `remove`). It starts the server at each login but, unlike the Mac version, does not restart it if it later stops.

**By hand instead:**

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e
irm https://claude.ai/install.ps1 | iex        # Claude Code, then run: claude
node server.js                                 # then open http://127.0.0.1:3030
```

`windows\install.ps1 -WithTailscale` installs Tailscale too.

---

## What it does

- **Projects and folders:** chats are grouped by the folder they ran in. **＋ New project** creates a named project with a new folder (default `~/Claude Projects/<name>`) or an existing one, and chats started in it appear under it. Click a group header to expand or collapse it. **Expand all** and **Collapse all** act on every group. Removing a project keeps its folder and chats.
- **Chats:** search, open, and continue any saved chat. Titles are Claude Code's own.
- **Model and effort pickers:** the list is read from the gateway named in `~/.claude/settings.json` (OmniRoute combos plus its Anthropic models).
- **Attachments:** attach files (up to 25 MB each, drag and drop works) or a folder (must be inside your home folder). Each upload sits in its own folder, and a chat can read only the uploads its own messages mention. Uploads are deleted after 30 days.
- **Stop button:** ends the run and kills the Claude process.
- **Downloads:** one chat as Markdown, Text, JSON, CSV, Web page, Word (`.docx` or old-style `.doc`) or PDF (browser print), plus all chats as one `.zip` of Markdown files.
- **Status light:** shows whether the gateway answers and whether Claude Code can be started. Refreshes every 30 seconds.

## Context and memory

- **Inside one chat, context continues.** Every message resumes the same saved session, so Claude sees the whole history. Very long chats get compacted by Claude Code, and a model with a small context window may struggle sooner.
- **Between chats, nothing carries over by itself.** Each new chat starts fresh.
- **Chats in the same folder share what Claude Code stores per folder:** that folder's `CLAUDE.md` instructions and its auto-memory (`~/.claude/projects/<folder>/memory`). Your global `~/.claude/CLAUDE.md` applies everywhere. This is why a project is simply a folder: all its chats share the same instructions and memory.
- **Switching models mid-chat is fine.** The history is resent each time, so a combo can fall back from a free model to a paid one without losing the thread.

## Permissions

Each message runs `claude -p` in the chat's folder in **auto** mode (Claude Code's AI judge). The judge lets routine work through and refuses risky actions. A short read-only list always runs without asking: web search, and read commands for `gh` and `composio`.

When something is refused, the page shows a card with the exact command and **Approve once** or **Deny**. Approving re-runs the turn allowing only that exact command (or one web domain). Approvals cannot contain wildcards or unbalanced brackets. Claude Code splits a rule list on spaces and commas, so a crafted command could otherwise carry a second rule with it.

The judge is a safety layer, not a guarantee. In testing it blocked hidden instructions that tried to send data out, and blocked force-pushes, but it was inconsistent on a normal push and did not stop deletes inside the project. Commit often.

Every run is capped at 60 turns (`CLAUDE_UI_MAX_TURNS`).

## Using OmniRoute (or another gateway)

Claude Code reads its endpoint from `~/.claude/settings.json`. Example (use your own values):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "<your gateway key>",
    "ANTHROPIC_MODEL": "<a model or combo name>"
  }
}
```

This page launches Claude Code with the `ANTHROPIC_*` and `CLAUDE_CODE_*` variables of its own environment removed, so `settings.json` is what decides.

The Claude desktop app sets its own endpoint and login, so it does not use this file. Only the terminal `claude` and this page do.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3030` | Port on 127.0.0.1 |
| `CLAUDE_BIN` | `~/.local/bin/claude` if it exists, else `claude` from PATH | Claude Code executable |
| `CLAUDE_PROJECTS` | `~/.claude/projects` | Where chats are read from |
| `CLAUDE_UI_DATA` | `~/.claude-local-ui` | Where projects are kept |
| `CLAUDE_UI_UPLOADS` | `~/.claude-local-ui/uploads` | Where attachments are saved |
| `CLAUDE_UI_MAX_TURNS` | `60` | Turn cap per message |
| `CLAUDE_UI_UPLOAD_DAYS` | `30` | Delete uploads older than this many days |

## Security

- Listens on 127.0.0.1 only. Requests with any other `Host` are refused (blocks DNS rebinding).
- Anything that changes state needs the `x-ui` header, which a web page on another site cannot send.
- Messages are limited to 1 MB, uploads to 25 MB. Project and attached folders are resolved (`../` and symlinks followed) and must stay inside your home folder.
- A new chat can start only in a project folder or a folder you already use with Claude Code.
- Anyone who can open the page on this computer can use your Claude Code. There is no login. Do not expose the port to a network.
- The server reads your gateway key from `settings.json` only to list models. It never sends it to the browser.

## Tests

```bash
node --test
```

Needs the `unzip` command (present on macOS and most Linux). The Windows scripts have no automated tests.

## Safety and disclaimer

Claude Chats can make Claude Code edit files and run commands on your computer. An AI judge decides what needs your approval, but it is not a guarantee. Work in folders you can restore, commit often, and read what you approve. The software is provided as is, with no warranty (Apache-2.0, see [LICENSE](LICENSE)).

This is an independent project. It is not made by or affiliated with Anthropic. "Claude" and the Claude logo belong to Anthropic; the Mac launcher icon uses the logo from your own installed Claude app and nothing of Anthropic's is stored in this repository.

## Known limits

- Replies appear when a turn finishes, not word by word. No Markdown rendering.
- Two writers on the same chat (this page and a terminal) can interleave. Do not use both at once.
- A chat remembers its uploads through its own messages, so an upload cannot be re-read after the 30-day cleanup.
- Developed and tested on macOS. Windows support is written but untested.
