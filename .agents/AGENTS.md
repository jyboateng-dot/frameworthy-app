# FrameWorthy Project Rules

- When adding new frame styles to the application, decline to add any frame style that is already featured in the FrameWorthy app.

## Multi-agent / multi-platform handoff

This repo gets worked on from more than one agent and more than one platform
— Claude Code on a PC, Claude Code's iOS app, other coding agents entirely.
None of them share session memory with each other. Before starting any new
work, however you were invoked:

1. Fetch the default branch (`master`) and read the recent commit log —
   author, timing, and subject line. Anything that doesn't match this
   session's own prior work is very likely from a different agent, platform,
   or person. Don't assume what an unfamiliar commit does from its message
   alone — read the actual diff (`git show <sha>`) for anything unclear.
2. Acknowledge what changed to the user before proceeding, briefly — this
   repo has hit real cases of one agent's fix conflicting with, duplicating,
   or getting silently overwritten by another's.
3. Run the build and test suite (`npm run build`, `npm test`) before making
   further changes. A failure here that you didn't cause yourself is a
   regression from whatever landed since this repo was last checked —
   surface it rather than working around or silently fixing it, unless it's
   clearly small and directly in the way of the task at hand.

Claude Code sessions do this automatically via the `SessionStart` hook at
`.claude/hooks/session-start.sh` (registered in `.claude/settings.json`) —
it runs on every session start regardless of surface. Agents that don't read
Claude Code's hook config should still follow the same steps manually.
