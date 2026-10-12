# TRACKER agents: handover for Martin and Ambrose

I wrote this so you can run the TRACKER agents when I am not around. Please read the status section first.

## What is in this package

- `CLAUDE.md`: the standing rules Claude Code reads at the start of every session.
- `.claude/commands/monthly-report.md`: the `/monthly-report` command.
- `HANDOVER.md`: this file.

I have kept every password, key and token out of this package, and none should ever be added to it.

## Status (read first)

- **TRACKER bug fix and feature workflow:** running. I use it for real fixes.
- **/monthly-report:** written, and I have run it once as a dry run. It stopped to ask which table counts as "containers", and I have not yet produced and checked a complete report. Until I confirm one full run, treat any report it produces as unverified. Check a few containers against the TRACKER screens before you share it with anyone.
- **Scheduling:** nothing runs on its own. A person types the command.

## Before you start

You need your own Claude seat with Claude Code, VS Code, Node.js (LTS) and Git on your machine, and your own access to the systems TRACKER reads from. Please do not use my access, and do not ask me for my keys in a chat or an email.

## Setup, once

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Get the code: `git clone https://github.com/KTL2050/kingdomlogistics.git TRACKER`. If the clone is refused, ask me to add you to the repository.
3. In the `TRACKER` folder, run `npm install`.
4. Create a file named `.env.local` in the `TRACKER` folder with these three names and your own values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   TRAQO_API_KEY=
   ```
   Get the values through the company's normal access route. Never paste them into the Claude chat, and never commit this file.
5. Open the `TRACKER` folder in VS Code, choose Terminal, New Terminal, and type `claude`.
6. Press Shift+Tab until the bottom line no longer says "auto mode". My rules file requires it to ask before every command.
7. Send this as your first message and read the answer: `Read CLAUDE.md and summarize it back to me in a few lines. Don't change anything yet.` The summary should mention asking before every command, reproducing a problem before calling it fixed, and separate approvals for commit and push. If it does not, stop and tell me.

## Running the monthly report

1. Type `/monthly-report`. It defaults to the previous full calendar month. To choose another month, say so after the command.
2. It inspects the database schema first and may ask which table counts as containers and which date field to use. Please do not guess. My recommendation so far is the `shipments` table, because it is the one the live app reads from. Confirm with me before the first run.
3. The report is saved as `reports/YYYY-MM-container-report.md`. Do not commit or push it. Send it to whoever I name.

## Rules that apply to every run

- Approve each command yourself, after reading what it will do. If you do not understand a command, say no and ask it to explain.
- The command is read-only. It must never write to the database. If it proposes to, stop.
- Do not edit `CLAUDE.md` or the command file. If a rule seems wrong to you, tell me.

## If something goes wrong

Stop. Note exactly what it asked for and what it did, and message me. Please do not try to repair the data or the code yourself.