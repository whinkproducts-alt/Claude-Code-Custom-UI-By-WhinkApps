# Claude Chats

A small local web page for [Claude Code](https://claude.com/claude-code). It lists every chat Claude Code has saved on this computer, shows the transcript, and lets you continue any chat or start a new one. It works with whatever models Claude Code is set up to use, including a gateway such as OmniRoute.

No database, no build step, no dependencies. Plain Node.

## Download and install (Mac)

**1. Download the code.** Either way works. The repository is private, so sign in to GitHub first.

- On the GitHub page: click the green **Code** button, then **Download ZIP**, and unzip it.
- Or in Terminal: `gh repo clone whinkproducts-alt/Claude-Code-Custom-UI-By-WhinkApps` (needs `gh auth login` once).

**2. Install what it needs.** Open Terminal in the downloaded folder and run:

```bash
sh install.sh
```

This installs git, Node.js 20+, Claude Code and the GitHub CLI, and skips anything you already have. It needs [Homebrew](https://brew.sh); if that is missing, the script prints the one command to install it. After a fresh Claude Code install, run `claude` once and sign in.

**3. Make the app icon.**

```bash
sh build-launcher.sh
```

This creates **Claude Chats** in your `Applications` folder (inside your home folder) with the Whink logo and a Claude badge. Double-click it to open the page; it starts the server first if needed. Drag it to your Dock to keep it there. The Claude badge is copied from your installed Claude app, so you need that app for the badge (without it you get the Whink logo alone).

**4. Optional: always on.** `sh autostart.sh install` starts it at every login (see below).

No Mac, or you prefer to do it by hand? The commands are:

```bash
brew install git node gh                      # git, Node.js 20+, GitHub CLI
curl -fsSL https://claude.ai/install.sh | bash   # Claude Code (then run: claude)
brew install --cask tailscale                 # optional: reach a gateway on another computer
node server.js                                # start it, then open http://127.0.0.1:3030
```

`install.sh --with-tailscale` installs Tailscale too. Your chats are read from `~/.claude/projects`, where Claude Code saves them. They live on each computer separately, so a second laptop shows only its own chats.

## What it does

- **Chats:** search, open, and continue any saved chat. Titles are Claude Code's own.
- **New chat:** pick a folder you already use with Claude Code.
- **Model and effort pickers:** the list is read from the gateway named in `~/.claude/settings.json` (OmniRoute combos plus its Anthropic models).
- **Attachments:** attach files (up to 25 MB each, drag and drop works) or a folder (must be inside your home folder). Each upload sits in its own folder, and a chat can read only the uploads its own messages mention. Uploads are deleted after 30 days.
- **Status light:** at the top of the sidebar, shows whether the gateway answers and whether Claude Code can be started. Refreshes every 30 seconds.
- **Stop button:** ends the run and kills the Claude process.
- **Downloads:** one chat as Markdown, Text, JSON, CSV, Web page, Word (`.docx` or old-style `.doc`) or PDF (browser print), plus all chats as one `.zip` of Markdown files.

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

## Start at login (macOS)

```bash
sh autostart.sh install    # start now and at every login, restart if it stops
sh autostart.sh status
sh autostart.sh remove
```

It runs the Node that is on your PATH when you install. If you upgrade Node with a version manager, run `install` again. The log is `~/.claude-local-ui/server.log`.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3030` | Port on 127.0.0.1 |
| `CLAUDE_BIN` | `~/.local/bin/claude` if it exists, else `claude` from PATH | Claude Code executable |
| `CLAUDE_PROJECTS` | `~/.claude/projects` | Where chats are read from |
| `CLAUDE_UI_UPLOADS` | `~/.claude-local-ui/uploads` | Where attachments are saved |
| `CLAUDE_UI_MAX_TURNS` | `60` | Turn cap per message |
| `CLAUDE_UI_UPLOAD_DAYS` | `30` | Delete uploads older than this many days |

## Security

- Listens on 127.0.0.1 only. Requests with any other `Host` are refused (blocks DNS rebinding).
- Anything that changes state needs the `x-ui` header, which a web page on another site cannot send.
- Messages are limited to 1 MB, uploads to 25 MB. Attached folders are resolved (`../` and symlinks followed) and must stay inside your home folder.
- Anyone who can open the page on this computer can use your Claude Code. There is no login. Do not expose the port to a network.
- The server reads your gateway key from `settings.json` only to list models. It never sends it to the browser.

## Tests

```bash
node --test
```

Needs the `unzip` command (present on macOS and most Linux).

## Known limits

- Replies appear when a turn finishes, not word by word. No Markdown rendering.
- Two writers on the same chat (this page and a terminal) can interleave. Do not use both at once.
- A chat remembers its uploads through its own messages, so an upload cannot be re-read after the 30-day cleanup.
- Tested on macOS only. `autostart.sh` is macOS only.
