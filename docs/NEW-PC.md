# Setting up a second computer (yours)

This is for **your own** extra computer. It reuses the OmniRoute that already runs on your first computer, so you don't install OmniRoute again. Setting up someone else's computer? Use [PASTE-INTO-CLAUDE.md](PASTE-INTO-CLAUDE.md) instead.

You need your first computer to be awake and online, because the gateway runs there.

## 1. Join your private network (Tailscale)

Install Tailscale on the new computer and sign in with the same account as your first one:

- Windows: `winget install --id Tailscale.Tailscale -e`
- Mac: `brew install --cask tailscale-app` (it asks for your password)

On the first computer you can see its private name in the Tailscale menu or with `tailscale status`. It looks like `my-mac.something.ts.net`. OmniRoute is shared there on port `20128`, so the address is `http://my-mac.something.ts.net:20128`.

## 2. Make a key for this computer

On the first computer open OmniRoute, **API Manager**, **Create API Key**, name it after the new computer, and copy it. Using a separate key lets you cap or delete it on its own.

## 3. Run setup on the new computer

Download this repository (ZIP, or `gh repo clone`), open a terminal in it, then:

```powershell
powershell -ExecutionPolicy Bypass -File windows\setup.ps1 -GatewayUrl http://my-mac.something.ts.net:20128
```
```bash
sh mac/setup.sh --gateway http://my-mac.something.ts.net:20128
```

It installs what is missing, puts **Claude Chats** on the Desktop, and asks for the key from step 2 (typing is hidden). It checks the key first and only then updates `~/.claude/settings.json`.

## 4. Check

Open **Claude Chats**. The top of the sidebar should say **Gateway connected**. Chats do not move between computers: each one shows only its own.

If it says "not reachable", check that Tailscale is connected on both computers and that the first computer is awake.
