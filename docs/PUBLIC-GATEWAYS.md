# Bring your own backup (free) LLM

Claude Chats is only a window onto Claude Code. It contains **no models and no keys**. You decide what Claude Code talks to.

## Your options

1. **Claude itself.** If you already use Claude Code with a Claude subscription or an Anthropic API key, it works as is. Install and open the launcher.
2. **A gateway you run yourself (what we use).** A gateway tries cheap or free models first and falls back to a paid one. We use [OmniRoute](https://github.com/diegosouzapw/OmniRoute) and have only tested with it. Step by step: [OMNIROUTE-CLONE.md](OMNIROUTE-CLONE.md).
3. **Another gateway.** Anything that speaks the same API as Anthropic's (a "Messages API") may work. We have not tested others.

## How to point Claude Code at a gateway

Claude Code reads `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "<your gateway key>",
    "ANTHROPIC_MODEL": "<a model or route name from your gateway>"
  }
}
```

For OmniRoute, `node omniroute/connect.js` writes this for you safely (it backs up the file and keeps your other settings).

Claude Chats then uses whatever Claude Code uses. The model picker lists what your gateway offers, and the status light at the top of the sidebar shows whether the gateway answers.

## Things worth knowing

- **Free models differ a lot.** In our own testing (November 2026) the same task worked on one free model about 98% of the time and on another 0% of the time. Try yours on a real task before you rely on it.
- **Keep your own keys.** Never put keys in this repository, in screenshots, or in chats. Use a separate key for each computer so you can revoke one without breaking the rest.
- **Spending.** If your gateway can fall back to a paid model, set a spending limit on the key.
- **It runs commands on your computer.** Claude Code can edit files and run commands, with an AI judge deciding what needs your approval. The judge helps but is not a guarantee. Work in a folder you can restore and commit your work often.
