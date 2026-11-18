# Set this up on someone else's computer with Claude

For when a friend or partner wants Claude Chats and her own free-first AI gateway, and you want her own Claude to do the work.

## How to use it

1. She needs **Claude Code** on her computer. Claude Code can run commands; an ordinary Claude chat cannot. In the Claude desktop app that is the **Code** tab, or run `claude` in a terminal.
2. She needs access to the code. If the repository is public she needs nothing. If it is private, add her GitHub account as a collaborator first.
3. She opens a new Claude Code session and pastes the text in the box below, all of it.
4. Then she follows Claude. Claude does the installing; she does the parts that must be hers (passwords, accounts, keys). It will ask her for those at the right moments.

She ends up with the Claude Chats launcher on her Desktop and her own OmniRoute gateway, using her own free accounts and keys. Nothing of yours is used.

Two things Claude cannot do for her, by design: type her passwords or keys, and create accounts. On a Mac without Homebrew she will also be asked to run one command herself in Terminal, because it needs her computer password.

## The text to paste

```text
You are helping me install "Claude Chats" (a local web page for Claude Code) on THIS computer, and set up my own free-first AI gateway (OmniRoute) for it. The code is here:

https://github.com/whinkproducts-alt/Claude-Code-Custom-UI-By-WhinkApps

Work through the steps in order. Run the commands yourself. Before each step, tell me in one short line what you are about to do. After each step, tell me in one or two lines whether it worked. If anything fails, show me the exact error and stop. Do not skip steps and do not improvise other installs. If you cannot run commands in this session, tell me now and stop.

RULES
- Everything is mine: my own accounts and my own keys. Never ask me for, or use, anyone else's keys or passwords.
- I type passwords, API keys and sign-ins myself. Never ask me to paste a key or password into this chat, and never type one for me. When a step needs one, tell me exactly where to type it, then wait for me to say "done".
- Do not create accounts for me. Give me the link and wait while I do it.
- Ask me before: installing anything not listed here, deleting any file, or changing anything outside these steps.
- Do not use providers that OmniRoute marks "tos: avoid" (for example Kiro or xKiro). Do not pass --include-risky.
- Do not push to GitHub, and do not change the repository.

STEPS
1. Find out whether this is a Mac or a Windows PC, and where my home folder is.
2. Download the code with git into a folder called Claude-Chats in my home folder (Mac: ~/Claude-Chats, Windows: %USERPROFILE%\Claude-Chats). If git is missing, tell me and ask before installing it. If the download says the repository is not found or access is denied, stop and tell me I need to ask the owner to give my GitHub account access, then help me sign in with "gh auth login" (I will do the browser sign-in myself).
3. Open a terminal in that folder and run the setup:
   - Mac: sh mac/setup.sh --with-omniroute
     If it says Homebrew is missing, show me the one command it prints and ask me to run it myself in Terminal (it needs my computer password), then re-run the setup.
   - Windows: powershell -ExecutionPolicy Bypass -File windows\setup.ps1 -WithOmniRoute
   This can take several minutes. OmniRoute is a large download. Tell me if it is taking long, but do not interrupt it.
4. When it finishes, check: node -v (OmniRoute needs 22.22.2 or newer), claude --version, and that http://localhost:20128 answers. On Windows, if a command is not found, open a new PowerShell window and try again.
5. Tell me to open http://localhost:20128 in my browser. A fresh OmniRoute has the default dashboard password CHANGEME. Tell me to set my own password in the dashboard settings now, and wait for "done".
6. Connect my own free providers. For each, give me the link and tell me to open Providers in the dashboard, add a connection, paste MY key into the dashboard myself, save, and test it. Wait for "done" after each:
   - Google Gemini key: https://aistudio.google.com/apikey
   - NVIDIA key: https://build.nvidia.com (sign in, then "Get API Key")
   - Optional: Groq key at https://console.groq.com/keys
   - Optional, paid, used only as the last fallback: Anthropic key at https://console.anthropic.com
7. Build my routes: run  node omniroute/apply-recipe.js --dry-run  and show me the summary. Then run  node omniroute/apply-recipe.js . It asks for my dashboard password; I type it. Show me the summary of what was created and what was skipped, and tell me what to connect if something was skipped.
8. Tell me to open API Manager in the OmniRoute dashboard, choose Create API Key, name it after this computer, and copy the key (it is shown once). Then run  node omniroute/connect.js . It asks for the key; I type or paste it there, never into this chat.
9. The "Claude Chats" launcher should now be on my Desktop. If it is not, run  sh mac/build-launcher.sh "$HOME/Desktop"  (Mac) or  powershell -ExecutionPolicy Bypass -File windows\build-launcher.ps1  (Windows). Tell me to double-click it. The top of the sidebar should say "Gateway connected". Tell me to send the message: Reply with exactly: ok
10. If I added an Anthropic key, remind me to set a daily usage limit on my key in API Manager.
11. Finish with a short summary: what is installed, what is still open, how to start it next time (double-click the launcher), and where the guides are: docs/OMNIROUTE-CLONE.md in the Claude-Chats folder.
```
