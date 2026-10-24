# Руководства по промтам для семейства 5.5: выжимка для двух скиллов

Выжимка из руководств Anthropic по Opus 5.5, Opus 5, Sonnet 5.5, Haiku 5.5 и общих best practices, seen 2026-10-08.

Seen 2026-10-08. Sources (platform.claude.com/docs/en/build-with-claude/prompt-engineering/): `claude-prompting-best-practices`,
`prompting-claude-opus-5-5`, `prompting-claude-opus-5`, `prompting-claude-sonnet-5-5`, `prompting-claude-haiku-5-5`;
claude-api skill `shared/model-migration.md` (sections Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.1), `shared/cost-optimization.md` s2.6-2.7, `shared/agent-design.md`.
Family constraint from the user: only 5.5 models (haiku-5-5, sonnet-5-5, opus-5-5); planner host may be Opus 5.5 or Fable 5.1.

## Prices ($/MTok in/out; cache read)
Haiku 5.5 0.10/0.50 (<=100K prompt; 0.50/2.50 above; cache read 0.1x) | Sonnet 5.5 2/10 (0.20) | Opus 5.5 4/20 (0.20) | Fable 5.1 10/50 (0.25). Haiku 5.5 tokenizer: ~30% more tokens than Haiku 4.5.

## Effort (applies to all three)
- Defaults: Haiku 5.5 medium, Opus 5.5 medium, Sonnet 5.5 high. Levels low/medium/high/xhigh/max. Thinking always on (Opus 5.5, Sonnet 5.5 can't disable; Haiku: disabled only <=high).
- "To get less thinking, lower the effort level" - prompt "think less" does not work reliably (Opus 5.5, Sonnet 5.5, Haiku 5.5 pages).
- Opus 5.5 medium >= Opus 5 high; low close on several coding evals. xhigh/max only with measured gain; they think more per turn than Opus 5.
- Sonnet 5.5: medium for well-specified agentic coding; high for harder/longer; low for chat/extraction/classification/search.
- Haiku 5.5: low = chat, short tool tasks, simple high-volume; in LONG agent prompts at low it skips search / stops early / skips checks. medium default for agentic coding; high for knowledge work + strict instruction following.
- cost-optimization s2.6: research/knowledge work curves nearly flat (low gives up few points for 1/3-1/2 cost); long-horizon coding: real tradeoff; "re-run failures at higher effort" held pass rate at ~half cost when a failure signal exists.

## Orchestration economics (cost-optimization s2.7) - drives the go/no-go gate
- Orchestrator (frontier plans, cheaper workers do bulk) "buys something only when there is bulk to hand off - many independent pieces, ideally too many for one context window". On one dependent chain or work that fits one context, "the orchestrator pays for a plan, a handoff, and a merge that a single model gets for free - in every such case measured, the coordinator's model alone at lower effort came out ahead".
- Check for "most capable model at lower effort" before building a cascade. Judge cost per completed task. Price the tail, not the median.
- Subagent for "one self-contained step with bulky intermediates, optionally on a cheaper model" - skip when the deciding model needs the intermediates.
- Subagent starts a fresh prefix with no cache shared with parent; each subagent re-establishes context, re-explores, reports back, coordinator re-reads (Opus 5 guide). Measured here: ~15k-token fixed start-up per subagent.

## Opus 5 / 5.5 as orchestrator
- Delegates readily -> cap deterministically: env `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (Claude Code >= 2.1.217; local is 2.1.294), SDK `max_budget_usd`. Prompt text: delegate only for large, genuinely independent, parallelizable work; not for what you finish in a handful of tool calls; not to verify/double-check; one subagent over several; keep spawn counts low.
- "Brief the subagent precisely the first time. If you delegate, commit: never redo the subagent's work nor re-derive its findings." Launch independent agents in one message.
- Over-verification: explicit "verify / use a subagent to verify / double-check" instructions cause over-verification; delete them (Opus 5 guide). Tension with the requested Opus cross-check: keep verification conditional + independent (fresh context, different evidence), test it.
- Scope: "Deliver what was asked at the scope intended... finish the whole task... stop short of actions clearly beyond the ask."
- Unattended runs (Opus 5.5): text-only end_turn mid-task is a report not completion; keep a checklist the model updates; if open items and no blocker, continue; stop after 2-3 automatic continuations. Name the early stops to avoid; keep confirmation for risky/irreversible.
- Opus 5.5 multiagent: pays attention to elapsed time; a time budget line ("elapsed 340s / 1200s") or "Time matters here..." made teams finish sooner at comparable quality.
- Progress updates: ask for cadence in the system prompt; positive examples beat prohibitions.
- Don't ask workers to write out reasoning (reasoning_extraction refusal, not retried on fallback). Ask for a short explanation + evidence.
- Fable 5.1 (planner host option): de-prescribe, give goal + constraints + reason; "when you have enough information to act, act"; delegation is dependable and async sub-agents beat spawn-and-block; fresh-context verifier sub-agents beat self-critique on long builds; audit progress claims against tool results; no explicit token-countdown (context anxiety).

## Sonnet 5.5 as worker
- Low/medium on long agentic tasks: stops to check in; skips verification. Add (verbatim from guide): "Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step. When the work the user asked for is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for..."
- Verification paragraph (verbatim in guides): run a real check that exercises the change (tests/type-checker/build); syntax-only does not count; install declared deps via project package manager; else say which check was not run and why.
- At xhigh/max it starts own review rounds, sometimes launching reviewer sub-agents: "Don't start extra rounds of review or hardening on your own, and don't launch reviewer sub-agents unless the user asked" cut session cost ~1/3 at max with no quality change.
- Tolerant handling of near-miss tool names; mid-turn user text must not sit in tool_result; harness notices separate and rare.
- JSON answer on a reasoning task: keep adaptive thinking, add "Think the problem through before you answer." for low/medium.

## Haiku 5.5 as worker / router
- Documented use: "high-volume, latency-sensitive work such as classification, routing, extraction, and sub-agent tasks"; "substantially better at instruction following and running as a sub-agent".
- No temperature/top_p/top_k, no prefill; thinking on by default (counts toward max_tokens); structured outputs / enum tool for classification; no server-side fallback for refusals.
- Early stopping + unverified "done" at low/medium in long prompts -> use the keep-working and verification paragraphs, or raise to medium/high; keep worker briefs short.
- Reasoning-like text leaks into replies with thinking off / low -> use adaptive + medium.

## General
- Be clear and direct; explain why; the "colleague test". Tell what to do, positive examples > prohibitions. XML tags to separate parts. Long inputs first, task last.
- State boundaries explicitly for destructive/shared-system actions; reversible local actions are fine.
- Multi-context-window work: state in files (structured JSON for status, free text for notes, git for checkpoints); fresh window + read state from disk often beats compaction; first window sets up framework.
- Skills/prompts written for older models are often too prescriptive; remove workarounds ("do not be lazy", refusal steering, tool-call shims) and tool-discouraging text ("minimize tool calls").
