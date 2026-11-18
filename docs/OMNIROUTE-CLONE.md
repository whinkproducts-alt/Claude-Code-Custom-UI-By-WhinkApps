# Your own OmniRoute, set up like the original, with your own keys

OmniRoute is a free gateway that sits between Claude Code and many AI providers. It tries free models first and, if you add one, falls back to a paid Anthropic key. This guide builds that setup on your own computer. Everything is yours: your accounts, your keys. Nothing is shared with anyone.

You will end up with:

- OmniRoute running on your computer at `http://localhost:20128`.
- Two ready-made routes (called *combos*): `claude-code-paid-middle` and `claude-code-paid-last`. Free models are tried first, paid Anthropic models last.
- Claude Code and Claude Chats pointed at it.

Plan on about 30 to 45 minutes, mostly waiting for downloads. It costs nothing unless you add a paid Anthropic key.

> **Rules.** Use only accounts and keys that are yours. Never paste a key into a chat or a file you share. Check each provider's terms: free tiers change, and some providers are marked by OmniRoute as risky for your account (see step 4).

## 1. Install

Download this repository, open a terminal in it, then:

```bash
sh mac/setup.sh --with-omniroute          # Mac
```
```powershell
powershell -ExecutionPolicy Bypass -File windows\setup.ps1 -WithOmniRoute     # Windows (not yet tested on a real PC)
```

This installs Git, Node.js, Claude Code and the GitHub CLI if missing, installs OmniRoute, starts it, and puts the **Claude Chats** launcher on your Desktop. OmniRoute is a large download, so be patient.

By hand instead: OmniRoute needs Node.js 22.22.2 or newer. Then `npm install -g omniroute` and run `omniroute`. (OmniRoute also publishes a Docker image; see its own docs.)

## 2. Set your dashboard password

Open <http://localhost:20128>. A fresh OmniRoute uses the default password `CHANGEME` until you change it. Set your own in the dashboard settings straight away.

## 3. Connect free providers with your own keys

In the dashboard go to **Providers**, pick a provider, choose **Add Connection**, paste your key into the dashboard, save, and test it. Type or paste keys only into the dashboard.

| Provider | Where to get a key | Notes |
|---|---|---|
| Google Gemini | <https://aistudio.google.com/apikey> | Free tier |
| NVIDIA | <https://build.nvidia.com> (sign in, then **Get API Key**) | Free credits and rate limits. Keys start with `nvapi-` |
| Groq (optional) | <https://console.groq.com/keys> | Free tier |
| Anthropic (optional, paid) | <https://console.anthropic.com> | Billed per use. Used only as the last fallback |

The more of these you connect, the more steps your combos get. Quotas and terms change, so read each provider's page.

## 4. Build the combos

```bash
node omniroute/apply-recipe.js --dry-run     # shows what it would do, changes nothing
node omniroute/apply-recipe.js               # does it
```

It asks for your dashboard password (typing is hidden). It then:

- creates `claude-code-paid-middle` and `claude-code-paid-last` using only the providers you connected;
- prices the free models at $0, so a spend cap on your key can still work;
- never overwrites a combo you already have.

Connected another provider later? Delete the combo in the dashboard and run it again.

**About xKiro.** The original setup also used a provider called xKiro, which gave the best results in testing. OmniRoute marks it `tos: avoid`, meaning your account there could be at risk, so this recipe skips it unless you add `--include-risky`. Expect somewhat weaker results without it.

## 5. Create your own key and point Claude Code at it

In the dashboard open **API Manager**, choose **Create API Key**, and copy the key. It is shown only once. Then:

```bash
node omniroute/connect.js
```

It asks for the key (hidden), checks that OmniRoute accepts it, backs up your `~/.claude/settings.json`, and adds only the lines it needs. Your other settings stay.

## 6. If you added a paid Anthropic key, set a spending limit

In **API Manager**, open your key and set a daily usage limit. If a limit makes requests fail with `BUDGET_EXCEEDED`, a model has no price set: price it at $0 in the dashboard under **Costs, Pricing** if it is a free model.

## 7. Open it

Double-click **Claude Chats** on your Desktop. The top of the sidebar should say **Gateway connected**. Send a message such as "Reply with exactly: ok".

## Troubleshooting

| What you see | What to do |
|---|---|
| "Gateway not reachable" | OmniRoute is not running. Run `omniroute`, or look at `~/.claude-local-ui/omniroute.log`. |
| "Claude Code not found" | Install it (`sh mac/install.sh`), then run `claude` once. |
| `401` | The key is wrong or was deleted. Create a new one and run `node omniroute/connect.js` again. |
| `429` and `BUDGET_EXCEEDED` | A model has no price. Price free models at $0 (step 6). |
| Replies fail or are poor | Free models vary a lot. Connect another provider, or move a better model to the top of a combo. |
