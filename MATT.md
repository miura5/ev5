# E.V. v5: your guide

Agents rebuild E.V. while you keep studying with the current app (ev4). You are the **student and customer**. You try what's ready, say what's wrong, and say "ship" when you like it. Everything else is the agents' job.

---

## Before the build: four steps, once

### 1. Answer the confirmations
Open `PLAN.md` §15. There are twelve questions, each with a recommended default. Reply **"all defaults"**, or give the numbers you'd change, e.g. "C3: build cards now".

### 2. Shape the look (the mock-up)
1. Start a new Claude chat and attach the small `ev5-mockup-kit` (the brief, the plan, mock-up A as the starting file, and annotated screenshots from earlier rounds).
2. Paste the prompt from `prompts/START-MOCKUP.md`.
3. Say what you like and don't like, in your own words ("Today feels busy", "I want the exam countdown bigger"). The design agent changes the mock-up and keeps it inside the rules that prevent drift.
4. When you're happy, say **"approved"**. The agent hands you the final `mockup.html` and a short list of anything it changed in the plan.

### 3. One-time setup (the only technical part)
- Create an empty GitHub repository named `ev5`. Upload the contents of this folder (`ev5-starter/`) as its first commit.
- In Claude Code (claude.ai/code), connect the `ev5` repo.
- Add these secrets to the repo. Each is a value you generate once:
  - a Cloudflare API token for staging;
  - a Cloudflare API token for live, which goes into a GitHub "live" environment that requires **your** approval;
  - an Anthropic API key for staging, with a low spend cap.

  The agents' first run tells you exactly where each one goes, if you're unsure.
- Turn on GitHub's "require checks before merging" and "auto-merge" for `main`. Again, the first run lists the clicks.

### 4. Start the build
1. Create a Claude Code **scheduled task** named "E.V. v5 build" on the `ev5` repo.
2. Paste in the prompt from `prompts/START-BUILD.md`.
3. Set it to run a few times a day.

That's it. It runs in the cloud with your laptop closed and uses your Claude plan.

---

## During the build

**Everything comes through one GitHub issue called "For Matt".** Turn on notifications for it in the GitHub phone app. Release cards and questions arrive there, and you reply there in plain words.

**You'll get release cards.** When something is ready to try on the v5 staging app, the card says what to try, by screen, in plain words. Try it when you have a moment between study blocks, then reply with one of:
- **"ship"**: you're happy with it (on staging, this just means "keep going");
- **"bug: …"**: in your own words; screenshots help;
- **"idea: …"**: it goes on the list, not into the current work.

**You'll sometimes get a question.** These only come when the decision is yours: money, your data, your Mac, or something you use daily. They are batched into one message, with a default you can accept by replying **"ok"**.

**Keep studying in ev4 as usual.** If ev4 breaks your studying, report it the way you do today. That's still ev4's own fix process.

**Exam week:** comment **"exam week"**. The build pauses new features and only fixes bugs. Say **"exam's over"** to resume.

**Following along, vaguely:** `docs/handover.md` in the repo always shows the phase (0 to 7), what's running, and what's waiting on you. You never have to read it.

---

## The few things only you can do

| When | What |
|---|---|
| Phase 0 | Say yes to the hard-limits section of CONTRACT.md (one message) |
| Phase 3 | OK one read-only check of a scratch copy of your data. It reports counts only and shows no content to anyone |
| Phase 6 | Be at your Mac once, while the agent creates the new Canvas sync task |
| Phase 7 | Test v5 on staging like a normal study day |
| Cutover | Say **"go live"**, approve the deploy in GitHub, and keep your devices online so no unsent notes are left behind |
| Any time after | Say **"go back"** to return to ev4. The agents run the rollback |
| End of the safety window | After one exam on v5, say **"keep v5"** to close the rollback window |

## What stays the same for you
- The **same app address** and the same phone icon.
- **Your data stays where it is.** Nothing is copied to staging, and nothing is deleted.
- E.V. still asks you to try first, and cites your notes. The goal is that you learn, not that she answers.
