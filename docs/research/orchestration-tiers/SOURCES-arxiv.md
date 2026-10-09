# Источники: статьи и первичные документы (arXiv, Anthropic, Cognition)

Отчёт исследовательского агента от 2026-10-08. Идентификаторы, названия, авторы и даты сверены по API arXiv; числа с пометкой full* взяты из полного текста через сводку страницы, не перечитаны по таблицам - перед внешним цитированием сверять с оригиналом. Статьи с пометкой [W] - рабочие гипотезы.

Date of research: 2026-10-08. Scope: LLM routing and cascades, planner-executor setups, orchestrator-worker multi-agent systems, adaptive effort, verification, 2026 work on delegation and sub-agents, and Haiku 5.5 as the routing decision maker.

## How things were checked

- **arXiv ids, titles, authors, dates, abstracts.** Every arXiv entry below was pulled from the official arXiv API (`export.arxiv.org/api/query?id_list=...`) and its abstract was read. An id is listed only if the API returned the matching title. Venues are stated only when the arXiv comment field names them.
- **Where each number comes from:**
  - `abs`: the number is in the arXiv abstract. These are verified.
  - `full*`: the number comes from the full-text HTML on arxiv.org, read through the WebFetch summarizer. The tables were not read line by line, so spot-check these before quoting them outside this report.
  - `doc`: the number comes from an Anthropic, Cognition or LMSYS page opened with WebFetch.
- **Quality tags:**
  - **[P]** peer-reviewed venue named in the arXiv comment.
  - **[L]** primary source from a major lab or vendor (blog post or docs).
  - **[Pre]** preprint with no venue.
  - **[W]** workshop paper, small n, or single-author report. Treat these as hypotheses.
- Many relevant 2026 papers are [Pre] or [W]. The rules at the end lean on [P] and [L] sources wherever possible.

---

## 0. Short answers

1. **Prompted LLM routers compared with trained routers.**
   - With no priors, a zero-shot LLM router loses to cheap trained classifiers on in-distribution data. Claude Sonnet 4.6 used zero-shot scored 41.4, against 47.3 for TF-IDF logistic regression (2606.22902, full*).
   - Given a table of per-category performance statistics, the same LLM router reaches 47.7, which matches the trained routers.
   - On out-of-distribution agentic coding, the trained routers collapse to 8.9-21.4, while Always-Opus scores 57.1.
   - Two other findings point the same way. Making the router's encoder larger does not help much (2609.34326). The commercial routers tested do not beat random routing between two well-chosen models (2610.02762).
   - Conclusion: the bottleneck is the information the router is given and the roster of models, not the router's intelligence. A cheap model working from an explicit rubric and a priors table is a reasonable router. An external routing API is not justified by this evidence.
2. **Known router failure modes:**
   - Difficulty blindness: the γ between difficulty and the chosen model is at most +0.20 (2610.02762).
   - Routing by category or source instead of by difficulty (2504.07113, 2610.02762).
   - Near-constant tier output. Always-Mid matches a real router (2608.14641).
   - Overconfidence that gets worse partway through agentic tasks (2512.24661, 2306.13063).
   - Adversarial "confounder gadgets" that force escalation to the expensive model (2501.01818).
3. **When multi-agent hurts:**
   - Sequential tasks: from -39% to -70% on PlanCraft.
   - Tool-heavy or shared-state tasks.
   - Cases where a single agent already succeeds more than about 45% of the time.
   - Comparisons at equal token budget. Overhead runs 58% to 515% more tokens. Independent agents amplify errors 17.2x, against 4.4x for a centralized design (2512.08296 full*, 2604.02460).
   - Parallel sub-agents in today's coding agents usually cost 1.4-3.3x the tokens and often lower success on bounded tasks (2610.10263 full*).
4. **Effort:** adapting effort per subtask cuts reasoning tokens by about 35-53% with little loss (2603.07915, 2604.05164). Uniformly low effort does hurt. Longer reasoning can also lower accuracy (2507.14417).
5. **Verification:** a second model reading the same evidence adds much less than independent evidence. In one study the evidence-source effect was 40.9 pp against 11.3 pp for model diversity (2609.10969, [W]). Model errors become more correlated as capability rises (2502.04313). Self-consistency, meaning several independent attempts plus a vote, is more compute-efficient than generative verification at most budgets (2504.01005).

---

## 1. LLM routing and cascades

**2305.05176: FrugalGPT** (Chen, Zaharia, Zou, 2023) [Pre]. https://arxiv.org/abs/2305.05176
- **Finding:** A learned cascade tries cheaper LLMs first and escalates when a learned quality scorer rejects the answer.
- **Number (abs):** Matches GPT-4 with up to 98% lower cost, or gains 4% accuracy at the same cost.
- **Implication:** Use "try cheap, escalate on a quality check" as the backbone. The savings depend on having a good per-answer quality signal.

**2406.18665: RouteLLM** (Ong et al., 2024) [Pre]. https://arxiv.org/abs/2406.18665
- **Finding:** Routers trained on preference data choose between one strong and one weak model, and they transfer when the model pair changes.
- **Number (abs):** More than 2x cost reduction with no quality loss.
- **Number (doc, LMSYS blog):** 95% of GPT-4 quality on MT Bench using 26% GPT-4 calls, or 14% with LLM-judge data augmentation. Routers trained only on Arena data were near random on MMLU.
- **Implication:** Generic routers degrade toward random outside the distribution they were trained on. Don't rely on a generic difficulty router for new kinds of task.

**2404.14618: Hybrid LLM** (Ding et al., ICLR 2024) [P]. https://arxiv.org/abs/2404.14618
- **Finding:** A router uses predicted query difficulty plus a quality threshold that can be tuned at test time.
- **Number (abs):** Up to 40% fewer calls to the large model with no drop in quality.
- **Implication:** Expose one "quality/budget" knob in the planner that shifts tier thresholds, rather than hard-coding a single policy.

**2310.12963: AutoMix** (Aggarwal et al., NeurIPS 2024) [P]. https://arxiv.org/abs/2310.12963
- **Finding:** The small model answers first and checks itself with few-shot self-verification. A POMDP router accounts for how noisy that check is.
- **Number (abs):** More than 50% lower compute cost at comparable performance.
- **Implication:** Verify-then-escalate works even with a noisy self-check, as long as the escalation policy treats the check as noisy.

**2403.12031: RouterBench** (Hu et al., 2024) [Pre]. https://arxiv.org/abs/2403.12031
- **Finding:** A benchmark and theoretical framework for routing.
- **Number (abs):** More than 405k recorded inference outcomes.
- **Implication:** Evaluate a routing policy offline on logged outcomes before trusting it.

**2410.10347: A Unified Approach to Routing and Cascading** (Dekoninck, Baader, Vechev, 2024) [Pre]. https://arxiv.org/abs/2410.10347
- **Finding:** Cascade routing is provably optimal. Good quality estimators are "the critical factor" in whether routing or cascading pays off.
- **Implication:** Put effort into quality signals such as tests, checks and agreement, more than into the router.

**2504.07113: How Robust Are Router-LLMs?** (Kassem, Schölkopf, Jin, 2025) [Pre]. https://arxiv.org/abs/2504.07113
- **Finding:** Routers make category-driven choices. A BERT router sends every coding and math query to the strongest model even when a smaller one would do, and sends jailbreak attempts to weaker models.
- **Implication:** Ban shortcuts such as "all code goes to Opus". Route on difficulty signals inside each category.

**2501.01818: Rerouting LLM Routers** (Shafran, Schuster, Ristenpart, Shmatikov, 2025) [Pre]. https://arxiv.org/abs/2501.01818
- **Finding:** "Confounder gadgets" that work regardless of the query can force any router to pick the strong model. Perplexity filtering does not stop them.
- **Implication:** When subtask text comes from untrusted content (web pages, issues), cap escalation and keep hard rules outside the LLM router.

**2601.07206: LLMRouterBench** (Li et al., 2026) [Pre]. https://arxiv.org/abs/2601.07206
- **Finding:** Under one shared evaluation, many routers perform about the same. Several recent ones, including commercial routers, fail to beat a simple baseline reliably. Larger model pools show diminishing returns compared with careful curation.
- **Number (abs):** More than 400K instances, 21 datasets, 33 models.
- **Implication:** Keep the roster small and curated (Haiku, Sonnet, Opus, and Fable only on exception).

**2610.02762: Dynamic LLM Routers are Often Misguided** (Wang et al., Oct 2026; under review at NAACL) [Pre]. https://arxiv.org/abs/2610.02762
- **Finding (abs):** None of six commercial routers beats random routing between two well-chosen models at matched cost. Some trail it by more than 10 pp. The paper names four failure patterns: difficulty blindness, length reversal, semantic matching, and a suboptimal roster.
- **Number (full*):**
  - The routers were OpenRouter auto, Azure Model Router, Not Diamond, vLLM Semantic Router, Nadir and OrcaRouter.
  - The γ between difficulty and the ability of the chosen model is at most +0.20.
  - Two or three models come close to the best achievable accuracy.
  - Quote: "the roster, not the router, determines nearly all of the accuracy".
- **Implication:** Three tiers is the right size. Judge any routing policy against a fixed or random mix at the same cost, and check difficulty discrimination inside each task source.

**2608.14641: Task- and Session-Level Model Routing** (Kumar, Saminathan, Jul 2026) [W]. https://arxiv.org/abs/2608.14641
- **Finding (abs):** Of four open-source routers tested on RouterBench, BFCL v4, tau2-bench and WebArena, three produce constant or near-constant tiers. Observed gains follow the mix of tiers selected, not task-specific targeting.
- **Number (abs):** Always-Mid matches Aurelio exactly on 3 of 4 benchmarks.
- **Implication:** "Always Sonnet at medium effort" is the baseline the planner has to beat. Log the distribution of tiers chosen.

**2609.34326: Routing Without Embeddings / RegexRoute** (Lu et al., Sep 2026) [Pre]. https://arxiv.org/abs/2609.34326
- **Finding:** Scaling the router's encoder from 0.5B to 72B (Qwen2.5) barely improves routing accuracy. The routing signal sits in shallow text features.
- **Number (abs):** 128 regex features give 76.43% accuracy, against 76.41% for the best neural encoder.
- **Implication:** A bigger router is not a better router. A small model such as Haiku is enough if it is given the right features and priors.

**2606.22902: Agent-as-a-Router** (Zhou et al., Jun 2026; living technical report) [Pre]. https://arxiv.org/abs/2606.22902
- **Finding (abs):** Routers are bottlenecked by an "information deficit". Adding performance statistics at the task-dimension level to a vanilla LLM router gives +15.3% relative. The paper proposes a Context, Action, Feedback loop with memory.
- **Number (full*, CodeRouterBench):**
  - In-distribution: zero-shot Claude Sonnet 4.6 router 41.41; with statistics 47.74; TF-IDF logistic regression 47.26; RouteLLM-BERT 47.22; RouteLLM-MF 46.16.
  - Out-of-distribution: trained routers fall to 8.9-21.4. Always-Opus-4.6 scores 57.14 and ACRouter 62.50.
  - The vanilla router's picks were "nearly uniform across dimensions". The authors conclude the bottleneck is "information rather than reasoning".
- **Implication:** A prompted router must be given a priors table (tier strengths, price, past outcomes by task type) and fed execution outcomes. It then matches trained routers and generalizes better.

**2607.00053: SWE-Router** (Son et al., ICML 2026 DL4Code workshop) [W]. https://arxiv.org/abs/2607.00053
- **Finding (abs):** Routing from the prompt alone has an error floor for software tasks, because the same issue text can hide a typo or a multi-module refactor. The fix: a cheap model runs a few exploratory turns, then the router decides whether to escalate. A theorem shows that conditioning on the partial trajectory never hurts.
- **Implication:** For coding subtasks, "probe cheaply, escalate on evidence" beats a difficulty guess made up front.

**2605.17106: HyDRA** (Garg et al., GitHub, 2026) [Pre/L]. https://arxiv.org/abs/2605.17106
- **Finding:** ModernBERT with four capability heads (reasoning, code generation, debugging, tool use), plus shortfall matching: pick the cheapest model whose profile meets the predicted requirements. Model profiles live in config, so no retraining is needed. Deployed in GitHub Copilot auto mode.
- **Number (abs, SWE-bench Verified):**
  - Peak-quality setting: 75.4% against 74.2% for Sonnet 4.6, at 12.9% savings.
  - Same quality as Sonnet: 54.1% savings.
  - Aggressive setting: 72.5% savings for -3.2 points.
- **Implication:** The planner should score each subtask on a few capability dimensions and pick the cheapest tier that covers all of them. Keep tier profiles in a config file.

**2506.09033: Router-R1** (Zhang, Feng, You, NeurIPS 2025) [P]. https://arxiv.org/abs/2506.09033
- **Finding:** The router is itself an LLM that alternates "think" and "route" actions. It conditions only on model descriptors (price, latency, example performance) and generalizes to models it has not seen.
- **Implication:** This supports an LLM router driven by a descriptor table. Note that this one was trained with RL.

**2506.16655: Arch-Router** (Tran et al., 2025) [Pre]. https://arxiv.org/abs/2506.16655
- **Finding (abs):** A 1.5B model maps queries to domain and action policies that the user defines. It is state of the art at matching human preferences and outperforms top proprietary models. New models are added without retraining.
- **Implication:** Frame routing as classification against an explicit policy rubric, a job small models do well, rather than asking for an open-ended estimate of how hard something is.

**2608.06867: LLMRouter / xRouteBench** (Feng et al., 2026) [Pre]. https://arxiv.org/abs/2608.06867
- **Finding and number (abs):** Learned routers beat the strongest fixed model by 14.6% relative. Lightweight routers become more competitive under tight cost limits.
- **Implication:** Expect modest gains, so routing logic should stay cheap.

Also verified, lower relevance:
- 2510.00202 RouterArena: an open router leaderboard.
- 2503.10657 RouterEval.
- 2510.09719 ICL-Router [AAAI 2026].
- 2510.19506 Lookahead Routing.
- 2609.37362 RouteFM.
- 2603.04445: survey on routing and cascading [TMLR 2026], a taxonomy of when, what and how.

### 1b. Self-estimating difficulty and overconfidence

**2207.05221: Language Models (Mostly) Know What They Know** (Kadavath et al., Anthropic, 2022) [L].
- **Finding:** Large models are well calibrated on multiple choice when the format is right. P(IK), the model's probability that it knows the answer, partly generalizes but is poorly calibrated on new tasks.
- **Implication:** Self-assessment is usable, but miscalibrated on new task types. Add outcome feedback.

**2306.13063: Can LLMs Express Their Uncertainty?** (Xiong et al., ICLR 2024) [P].
- **Finding:** Verbalized confidence is overconfident. Agreement across samples helps.
- **Number (abs):** Failure-prediction AUROC is 0.605 for white-box methods against 0.522 for black-box.
- **Implication:** Use agreement between samples, not a stated "confidence: 0.9".

**2512.24661: Do LLMs Know What They Are Capable Of?** (Barkan, Black, Sourbut, Dec 2025) [Pre].
- **Finding (abs):**
  - Every LLM tested is overconfident, though most discriminate better than chance.
  - Newer and larger models do not discriminate better, except for a trend in Claude models.
  - On multi-step agentic tasks, overconfidence gets worse as the task goes on.
  - Reasoning models do no better than non-reasoning ones, or worse.
  - Showing past failures in context reduces overconfidence in some models.
- **Implication:** Never use an executor's self-report ("done", "confident") as the escalation signal. Put the failure history into the router's prompt.

**2604.19781: Do Small LMs Know When They're Wrong?** (Burleigh, NCME 2026) [W].
- **Finding (abs):** Verbalized confidence as the escalation signal in cascades built from GPT-5.4, Claude 4.5+ and Gemini 3.1 model pairs.
- **Number (abs):**
  - The best small model reached AUROC 0.857. One small model produced near-degenerate confidence.
  - The best cascade scored kappa 0.802 against 0.819 for the large model, at 76% lower cost and 61% lower latency.
  - Quote: "Confidence discrimination is the bottleneck".
- **Implication:** Measure how well Haiku 5.5's confidence discriminates on your own tasks before relying on it.

**2603.03752: COREA** (Zhang et al., EACL 2026) [P].
- **Finding:** A small model plus verbalized confidence plus RL calibration.
- **Number (abs):** 21.5% and 16.8% lower cost, with at most 2 points lost on pass@1.
- **Implication:** Confidence-gated cascades work, but this result needed calibration training.

---

## 2. Plan-and-execute with a strong planner and weak executors

**2305.04091: Plan-and-Solve** (Wang et al., ACL 2023) [P].
- **Finding (abs):** Planning first and then executing beats zero-shot chain-of-thought on all ten datasets, and is comparable to 8-shot chain-of-thought on math.
- **Implication:** An explicit plan step pays off even with a single model.

**2305.18323: ReWOO** (Xu et al., 2023) [Pre].
- **Finding:** Separating reasoning from tool observations means the plan is written once with placeholders.
- **Number (abs):** 5x token efficiency and +4% accuracy on HotpotQA. Reasoning was offloaded from 175B GPT-3.5 to 7B LLaMA.
- **Implication:** A plan written up front with explicit inputs and outputs lets executors be small and avoids re-sending context.

**2312.04511: LLMCompiler** (Kim et al., ICML 2024) [P].
- **Finding:** The planner emits a task DAG and an executor runs independent nodes in parallel.
- **Number (abs):** Compared with ReAct: up to 3.7x faster, up to 6.7x cheaper, and about 9% more accurate.
- **Implication:** The planner's output should be a DAG with explicit dependencies so the executor can parallelize safely.

**2311.05772: ADaPT** (Prasad et al., NAACL 2024 Findings) [P].
- **Finding:** Decompose a subtask only when the executor fails at it. Decomposition adapts to the executor's capability.
- **Number (abs):** Success rate up 28.3% on ALFWorld, 27% on WebShop and 33% on TextCraft.
- **Implication:** Trigger replanning on executor failure. Decompose the failed node further rather than planning everything deeply up front.

**2210.02406: Decomposed Prompting** (Khot et al., ICLR 2023) [P].
- **Finding:** Sub-tasks are delegated to a library of dedicated handlers, with recursion allowed.
- **Implication:** Map subtask types to a small library of agent types or skills.

**2402.15000: Divide-or-Conquer?** (Wu et al., EMNLP 2024 Findings) [P].
- **Finding (abs):** The decomposition skill can be distilled into a small model and generalizes. Problem solving is hard to distill because it needs domain knowledge.
- **Implication:** Planning routine decompositions does not always need the top tier. Knowledge-heavy solving does. Spend top-tier budget on knowledge-heavy research and verification nodes.

**2506.11578: COPE, Efficient LLM Collaboration via Planning** (Lee et al., TMLR 2026) [P].
- **Finding:** Small and large models take turns as planner and executor in a three-stage cascade with consensus thresholds.
- **Number (full*):**
  - MATH-500: 75.8% against 75.2% for GPT-4o, at about 45% lower paid cost.
  - MBPP: about 74% lower cost.
  - A plan from a stronger model raised a Llama-3B executor from 42.8% to 53.0%.
  - Plans from a small model hurt a large executor: 73.8% fell to 69.6-70.6%.
  - Latency was about 2.35x higher.
- **Implication:** Strong plans with weak executors work. Weak plans for strong executors hurt. Escalate on lack of consensus. Expect extra latency.

**2503.09572: Plan-and-Act** (Erdogan et al., 2025) [Pre].
- **Finding:** Separate Planner and Executor models. Plan quality is the main lever, and the planner was trained on synthetic plans.
- **Number (abs):** 57.58% on WebArena-Lite.
- **Implication:** Put the strongest model on planning and replanning.

**2401.07324: Small LLMs Are Weak Tool Learners** (Shen et al., 2024) [Pre].
- **Finding:** Splitting the work into planner, caller and summarizer roles helps small models.
- **Implication:** When cheap executors are used, give each one a single narrow role.

**2402.01817: LLM-Modulo** (Kambhampati et al., 2024; position paper) [Pre].
- **Finding:** LLMs cannot plan or verify themselves alone. Pair them with external model-based verifiers.
- **Implication:** Check plans with deterministic validators: DAG acyclicity, disjoint file ownership, budgets.

**2609.32917: Planner-as-Router (PaR)** (Singh et al., AIxSET 2026) [W].
- **Finding (abs):** While decomposing, the planner assigns each subtask a small, mid or frontier tier, so dependencies are visible. No router model or training data is needed.
- **Number (abs):**
  - 44% lower cost than all-frontier, for -2.9 points of accuracy.
  - Matches the heuristic of using the frontier model only on terminal nodes, and beats a FrugalGPT cascade on cost.
  - n = 54 tasks with a CI of about ±6 points. A pilot hints at a compounding penalty for cheap routing in compositional workflows.
- **Implication:** This is close to Skill A's design. Keep "frontier only on the synthesis node" as a mandatory baseline.

**2506.05901: R2-Reasoner** (Shao et al., 2025) [Pre].
- **Finding:** A decomposer plus a subtask allocator spread work across nine models, with RL training.
- **Number (abs):** 84.46% lower API cost at competitive accuracy.
- **Implication:** Allocating models per subtask is where the large savings are.

**2609.22951: AgentRouter** (Paul, Nandy, ICML 2026 AgenticUQ workshop) [W].
- **Finding:** A 12M-parameter classifier routes each step to one of four tiers.
- **Number (abs):**
  - 72% lower cost while keeping 97.3% of frontier-only quality.
  - Routing accuracy per step: 91% on minimal steps, 76-82% on mid and frontier steps.
  - Applied per step, RouteLLM and FrugalGPT cut cost by only 31% and 44%.
- **Implication:** Routing errors concentrate at the boundary between the mid and frontier tiers. Spend probes and verification there.

**2609.34712: RSI-Router** (Li et al., Sep 2026) [Pre].
- **Finding:** Model assignments per subtask and model-specific skills are evolved from past trajectories.
- **Number (abs):**
  - About 48.3% of the cost of the large model alone across five agentic benchmarks, while beating it.
  - 74.7-82.2% lower cost on ALFWorld, ScienceWorld and WebShop.
  - Terminal-Bench 2.0: +16.7% relative at 18% lower cost.
- **Implication:** Write tier-specific instructions for cheap executors. Procedural knowledge makes up for a weaker model.

---

## 3. Orchestrator-worker multi-agent systems: cost, failures, when they hurt, handoffs

**Anthropic, "How we built our multi-agent research system"** (Hadfield et al., 2025-06-13) [L]. https://www.anthropic.com/engineering/built-multi-agent-research-system
- **Finding (doc):** An Opus 4 lead with Sonnet 4 subagents.
- **Numbers (doc):**
  - 90.2% better than single-agent Opus 4 on Anthropic's internal research eval.
  - Token usage alone explains 80% of performance variance. With tool calls and model choice, the three factors explain 95%.
  - Agents use about 4x the tokens of chat. Multi-agent systems use about 15x.
  - Upgrading the model helped more than doubling the token budget.
- **Effort-scaling rules from the prompts:**
  - Simple fact-finding: 1 agent and 3-10 tool calls.
  - Comparisons: 2-4 subagents with 10-15 calls each.
  - Complex research: more than 10 subagents with clearly divided responsibilities.
  - The lead runs 3-5 subagents in parallel.
- **Failures seen:** 50 subagents spawned for simple queries; duplicated work caused by vague briefs.
- **Brief template:** objective, output format, guidance on tools and sources, task boundaries.
- **Poor fits:** tasks where all agents need shared context or have many dependencies, and most coding tasks.
- **Implication:** This is the core template for Skill A's effort-scaling table and the brief schema. Opus as lead and Sonnet as workers is the configuration validated in the field.

**Anthropic, "Effective context engineering for AI agents"** (Rajasekaran et al., 2025-09-29) [L].
- **Finding (doc):** Subagents may use "tens of thousands of tokens or more" internally but return a "condensed, distilled summary ... (often 1,000-2,000 tokens)". The post also covers context rot, compaction, and structured notes.
- **Implication:** Executor contract: return at most about 2k tokens plus references to artifacts. The orchestrator keeps the plan in a file.

**Anthropic, "Building effective agents"** (Erik S., Barry Zhang, 2024-12-19) [L].
- **Finding (doc):**
  - Orchestrator-workers suits tasks whose subtasks cannot be predicted in advance.
  - Advice: "finding the simplest solution possible, and only increasing complexity when needed".
  - Routing example: easy or common questions go to Haiku 4.5, harder ones to Sonnet 4.5.
  - Evaluator-optimizer works when there are clear evaluation criteria.
- **Implication:** The planner's first decision is whether orchestration is justified at all.

**Cognition, "Don't Build Multi-Agents"** (Walden Yan, 2025-06-12) [L]. https://cognition.com/blog/dont-build-multi-agents
- **Finding (doc):** Two principles: "Share context, and share full agent traces, not just individual messages", and "Actions carry implicit decisions, and conflicting decisions carry bad results". The post's example is subagents building incompatible halves of a Flappy Bird clone. It cites Claude Code subagents, which answer well-defined questions and do not write in parallel, as restraint.
- **Implication:** Parallel writers on one shared artifact are an anti-pattern. Make subagents investigative or read-only, or give them disjoint ownership.

**2503.13657: MAST, Why Do Multi-Agent LLM Systems Fail?** (Cemri et al., 2025, v3) [Pre].
- **Finding (abs):** 1600+ annotated traces across 7 frameworks. 14 failure modes in 3 categories: system design, inter-agent misalignment, and task verification. Annotator agreement kappa = 0.88.
- **Number (full*, prevalence):**
  - Step repetition 15.7%.
  - Mismatch between reasoning and action 13.2%.
  - Unaware of termination conditions 12.4%.
  - Disobeying the task specification 11.8%.
  - Incorrect verification 9.1%.
  - Missing or incomplete verification 8.2%.
- **Number (full*, interventions):** Better role specification +9.4%. An added high-level verification step +15.6%. Verifiers "perform only superficial checks".
- **Implication:** Every plan node needs explicit termination criteria and verification against the objective, not just "does it compile".

**2505.00212: Which Agent Causes Task Failures and When?** (Zhang et al., 2025) [Pre].
- **Number (abs):** The best automated attribution identifies the responsible agent 53.5% of the time and the decisive step only 14.2%.
- **Implication:** An orchestrator cannot reliably work out from free-form logs which subagent failed. Require structured outputs with evidence for each node.

**2512.08296: Towards a Science of Scaling Agent Systems** (Kim et al., Google Research, Google DeepMind, MIT; Dec 2025, v3 Apr 2026) [Pre/L].
- **Finding (abs):** 260 configurations across 6 benchmarks, 5 architectures and 3 model families. Coordination gives diminishing returns once a single agent performs well. Tool-heavy tasks incur multi-agent overhead. Designs without centralized verification propagate errors more.
- **Number (abs):** Relative change ranges from +80.8% on decomposable financial reasoning to -70.0% on sequential planning. The predictive model picks the best architecture for 87% of held-out configurations.
- **Number (full*):**
  - Negative returns once single-agent accuracy exceeds about 45%.
  - Error amplification at trace level: independent 17.2x, decentralized 7.8x, hybrid 5.1x, centralized 4.4x. The main effect is not significant in the regression.
  - Token overhead: independent 58%, decentralized 263%, centralized 285%, hybrid 515%.
  - Per-agent reasoning gets "prohibitively thin beyond 3-4 agents".
  - Turn count grows super-linearly with the number of agents.
- **Implication:**
  - Spawn subagents only for decomposable or parallel subtasks.
  - Use a centralized design where the orchestrator verifies.
  - Cap concurrency at about 3-4.
  - Skip multi-agent when one agent is likely to succeed or the task is sequential.

**2604.02460: Single-Agent LLMs Outperform Multi-Agent Systems ... Under Equal Thinking Token Budgets** (Tran, Kiela, Apr 2026) [Pre].
- **Finding (abs):** At equal reasoning tokens, a single agent matches or beats multi-agent systems on multi-hop reasoning. Reported multi-agent gains are mostly unaccounted compute and context effects. Multi-agent becomes competitive when a single agent's use of its context degrades.
- **Implication:** Justify each subagent by the need to isolate context or by heterogeneity, not by "more minds".

**2601.12307: Rethinking the Value of Multi-Agent Workflow (OneFlow)** (Xu et al., Jan 2026) [Pre].
- **Finding (abs):** A single agent reaches the performance of homogeneous workflows and gains from KV-cache reuse. Workflows that use different LLMs cannot be simulated this way.
- **Implication:** The real value of multiple agents is heterogeneity, meaning different models, effort levels and tools. That is what tiering provides.

**2505.18286: Single-agent or Multi-agent Systems? Why Not Both?** (Gao et al., 2025) [Pre].
- **Finding:** The advantage of multi-agent over single-agent shrinks as models get stronger.
- **Number (abs):** Cascading requests between single-agent and multi-agent setups gives +1.1-12% accuracy and up to 20% lower cost.
- **Implication:** Default to a single agent and escalate to multi-agent only when needed.

**2610.10263: When Sub-Agents Work in Parallel** (Li et al., Oct 2026) [Pre].
- **Finding (abs):** 354 tasks and 2,124 runs of Codex, Claude Code and Kimi Code with sub-agent concurrency on and off. The paper catalogs 13 failure modes specific to concurrency.
- **Number (full*), concurrent against sequential:**
  - Claude Code on SWE-bench Verified: 59.0 against 83.0, so concurrency was worse.
  - Concurrency was better on NL2Repo (65.4 against 57.7) and LoopsBench (21.4 against 7.1).
- **Number (full*), costs:** Tokens 1.41-3.31x. Runtime went up in 14 of 15 combinations.
- **Number (full*), failure modes:**
  - Shared state and merging 33.2%, including overwritten deliverables at 14.9%.
  - Execution governance 29.0%, including subagents terminating early at 15.9%.
  - Orchestration 28.5%, including load imbalance and over-spawning at 20.6%.
  - Global context management 9.3%.
- **Implication:** Use concurrency only for long tasks with independent parts. Never let two writers share a deliverable. The orchestrator must monitor, join and verify.

**2609.09233: Subagents vs Agent Skills** (Piriyakulkij et al., Sep 2026) [Pre].
- **Finding (abs):** Running a skill as a subagent in a fresh context beats loading it into the main context when the skill has a clear input/output contract and procedural instructions. The cost is communication overhead.
- **Implication:** Spawn a subagent only for subtasks that have a clear contract. Fold everything else into the orchestrator.

**2601.04748: When Single-Agent with Skills Replace Multi-Agent Systems** (Li, Jan 2026; single-author report) [W].
- **Finding (abs):** Skill-selection accuracy holds steady up to a critical library size and then drops sharply. Confusable skills drive the drop, and hierarchical routing helps.
- **Implication:** Keep the executor's menu of agent types small and clearly distinct.

**2610.00041: The Delegation Danger Band** (Hu, Ramachandran, Sep 2026; submitted to a NeurIPS 2026 workshop) [W].
- **Finding (abs):** When a child agent inherits the parent's full context, including superseded conclusions, mid-capability models are hurt most (a significant local minimum at Qwen3-1.7B). A curated, selective handoff beats full inheritance on all 3 datasets.
- **Implication:** Give cheap executors curated briefs, not the orchestrator's transcript, and strip superseded conclusions.

**2608.29028: Facts Without Rules** (Wang et al., Aug 2026) [Pre].
- **Finding:** Handoff summaries keep facts but drop the constraints that govern them.
- **Number (abs):**
  - A 25-word budget cuts boundary-marker survival from about 0.80 to about 0.57, while survival of facts stays near ceiling.
  - Vague constraints leak in 73% of GPT cases. Explicit constraints leak in fewer than 15%.
- **Implication:** Briefs need an explicit, verbatim "Constraints / Do-not" field that is never summarized.

**2608.25277: Routed Graph Handoff** (Banerjee, Chadha, EMNLP 2026) [P].
- **Finding:** Natural-language messages consume 40-60% of a multi-agent token budget. A lightweight LLM router (155 tokens) chooses per delegation between a typed dependency graph and natural language.
- **Number (abs):**
  - +12.7 pp on τ-retail at 3.2x compression, and +8.7 pp on BrowseComp.
  - Graph-only delegation regresses 14.6 pp on AppWorld.
  - The executor prompt has to explain the schema.
- **Implication:** A structured brief schema saves tokens, but keep a free-text field and document the schema in the executor skill. A tiny LLM router is enough for this kind of format decision.

**2610.06069: Attention Tax, Handoff Tax** (Anchan, Sen, Oct 2026) [W].
- **Finding (abs):** Decomposition wins once the attention cost avoided exceeds the handoff cost. Parallel sampling wins once its floor of shared failures is below the error floor of a single agent thinking longer.
- **Number (abs):** On a ledger task the crossover is at depth 10, and decomposition wins at depths 20, 50 and 100.
- **Implication:** Decompose long or deep tasks. Keep short ones in a single agent.

**2609.13800: Do Not Restart, Residual Completion for Stateful Agent Handoffs** (Deng et al., Sep 2026) [Pre].
- **Finding:** Handoffs between models must preserve accepted choices, effects already realized, and obligations still open.
- **Number (abs):** Accuracy comparable to strong full-task agents at 22.0-34.6% of the cost.
- **Implication:** When escalating Haiku to Sonnet to Opus, pass a residual contract (done, decided, remaining) and do not restart from scratch.

**2605.27787: Librarian** (Cho et al., EMNLP 2026) [P].
- **Finding:** Output tokens dominate cost, and agents keep re-exploring the same code regions.
- **Number (abs):** An output token costs 30-1,000x the energy of an input or cached token. A persistent search sub-agent that returns references cuts energy by 11-30% with no loss.
- **Implication:** Keep a shared findings file. Subagents should return file:line references, not excerpts.

**2410.02506: AgentPrune** (Zhang et al., 2024) [Pre].
- **Number (abs):** Comparable results at $5.6 against $43.7, with 28.1-72.8% fewer tokens, by pruning redundant messages between agents.
- **Implication:** Hub-and-spoke only, with no chatter between peers.

**2508.02694: Efficient Agents** (Wang et al., 2025) [Pre].
- **Number (abs):** Keeps 96.7% of OWL's performance while cost falls from $0.398 to $0.228, a 28.4% better cost-of-pass.
- **Implication:** Use cost-of-pass, meaning cost per successful task, as the metric for comparing plans.

**2411.04468: Magentic-One** (Fourney et al., Microsoft, 2024) [L].
- **Finding:** The orchestrator plans, tracks progress and re-plans to recover from errors.
- **Implication:** The executor loop should keep a progress ledger and re-plan when a step stalls.

Also verified, briefly:
- **2505.19591 Puppeteer** [NeurIPS 2025]: an RL orchestrator converges on compact, cyclic structures at lower cost.
- **2502.11133 MasRouter:** routes collaboration mode, roles and LLMs, with up to 52.07% less overhead on HumanEval.
- **2509.11079 DAAO** [WWW 2026]: query difficulty picks the workflow complexity and is updated from workflow success.
- **2602.03786 AOrchestra:**
  - Each sub-agent is a tuple of Instruction, Context, Tools and Model, made concrete by the orchestrator at each step.
  - +16.28% relative over the strongest baseline on GAIA, SWE-Bench and Terminal-Bench (abs).
  - Use this tuple, plus effort, as the plan schema for each node.
- **2606.31174 ClawArena-Team:**
  - Measures how well a leader LLM manages a fixed pool of subagents.
  - No model exceeds 50% precision on workspace permissions.
  - API cost varies more than 100x while scores vary less than 4x (abs).
  - Implications: an expensive orchestrator does not guarantee good management, and least-privilege tool grants must be written explicitly in the plan.
- **2602.11865 Intelligent AI Delegation** (Tomašev, Franklin, Osindero, Feb 2026):
  - A framework for delegation: allocation, transfer of authority, responsibility and accountability, role boundaries, clarity of intent, and trust.
  - Each brief should state authority (what the agent may change) and accountability (what evidence it must return).
- **2505.06120 LLMs Get Lost in Multi-Turn Conversation** (Laban et al., 2025):
  - Performance drops 39% on average when instructions arrive over several turns, and models "do not recover" from early wrong assumptions (abs).
  - Send a complete brief in one message. Respawn rather than steer a subagent that has derailed.
- **2406.02818 Chain-of-Agents:** worker agents handle short contexts sequentially and a manager synthesizes. Up to 10% better on long-context tasks (abs).

---

## 4. Adaptive compute and effort allocation

**2408.03314: Scaling Test-Time Compute Optimally** (Snell et al., 2024) [Pre].
- **Number (abs):** Allocating compute per prompt by difficulty is more than 4x more efficient than best-of-N. Where a smaller model has non-trivial success, extra test-time compute can beat a 14x larger model.
- **Implication:** For subtasks a cheaper tier sometimes solves, more effort or samples on that tier is efficient. For subtasks it cannot solve, move up a tier.

**2410.04707: Learning How Hard to Think** (Damani et al., 2024) [Pre].
- **Number (abs):** Up to 50% less computation at no quality cost, or up to 10% better quality at a fixed budget.
- **Implication:** Predicting difficulty to allocate compute is worth doing.

**2412.21187: Do NOT Think That Much for 2+3=?** (Chen et al., 2024) [Pre].
- **Finding:** o1-like models overthink simple problems. The abstract gives no headline number.
- **Implication:** Run trivial subtasks at low effort.

**2508.13141: OptimalThinkingBench** (Aggarwal et al., 2025) [Pre].
- **Finding (abs):** None of the 33 models thinks optimally. Thinking models overthink for hundreds of tokens on the simplest queries. Large non-thinking models underthink and fall short of much smaller thinking models.
- **Implication:** Effort matters in both directions. A smaller tier at higher effort can beat a larger tier at minimal effort on reasoning-heavy subtasks.

**2507.14417: Inverse Scaling in Test-Time Compute** (Gema et al., TMLR 2025) [P].
- **Finding (abs):** Longer reasoning can lower accuracy. Claude models become "increasingly distracted by irrelevant information". Longer reasoning can also amplify concerning behaviors.
- **Implication:** Don't default to max effort. Use low or medium for simple or distractor-heavy subtasks.

**2412.18547: TALE** (Han et al., 2024).
- **Finding:** Putting a token budget in the prompt compresses reasoning, but the choice of budget matters.

**2505.13379: Thinkless** (Fang et al., 2025).
- **Number (abs):** Use of long chain-of-thought falls 50-90%.

**2510.27042: e1** (Kleinman et al., 2025).
- **Number (abs):** Chain-of-thought gets 2-3x shorter with performance maintained or improved.
- **Note:** All three of these papers involve training. Their shared implication is that most queries do not need long thinking.

**2603.07915: Ares, Adaptive Reasoning Effort Selection for Agents** (Yang et al., Mar 2026) [Pre].
- **Finding (abs):** Low effort at every step "leads to significant performance degradation", and random selection does not help. A lightweight router predicts the lowest effort that works for each step.
- **Number (abs):** Up to 52.7% fewer reasoning tokens than fixed high effort, with minimal loss on TAU-Bench, BrowseComp-Plus and WebArena.
- **Implication:** Choosing effort per subtask is worth it, but uniformly low effort is not safe.

**2604.05164: TAB, Turn-Adaptive Budgets** (Jali, Nayak, Joshi, 2026) [Pre].
- **Number (abs):** Up to 35% fewer tokens and 30% lower latency. When the full plan is known in advance, up to 40% savings.
- **Implication:** A planner that sees the whole DAG allocates effort better than per-step decisions.

**2606.23181: DART** (Lee et al., EMNLP 2026 Findings) [P].
- **Finding (abs):** Sample two cheap no-think drafts. If they agree, answer directly. If they disagree, set the thinking budget from the drafts' entropy. No training is needed, and it works on API-only models.
- **Number (abs):** 32-73% fewer thinking tokens, with up to +9.0 points on Olympiad math and up to +22.5 on code.
- **Implication:** Agreement between two cheap samples is a difficulty signal that needs no training. Use it in the Haiku router.

**2503.15113: Reasoning Effort and Problem Complexity** (Estermann, Wattenhofer, ICLR 2025 workshop) [W].
- **Finding (abs):** Reasoning effort scales with problem size only up to a critical complexity, then plateaus or falls.
- **Implication:** Past a complexity threshold, decompose instead of raising effort.

**2607.02436: Reasoning effort, not tool access, buys first-try reliability** (Mehta, 2026; single-author observational study) [W].
- **Number (abs):**
  - Raising effort from High to xHigh lifted perfect first-try runs from 28% to 89% and cut corrective prompts about 5x, for 9-29% more cost.
  - A testing tool added 42-68% to cost with no gain.
- **Implication:** For long single-shot builds, extra effort can be cheaper than repair loops. Treat this as a weak signal.

**2608.03169: Low Reasoning Effort Is Enough for Routine Office Work** (Xu, Wu, 2026) [W].
- **Number (abs):** GPT-5.6 at low against max effort on 14 routine tasks: same adherence to rules, 43% fewer output tokens and 20% less time.
- **Implication:** Run routine and mechanical subtasks at low effort.

**2608.16956: The Price of Thinking** (Moon, 2026) [W].
- **Number (abs):** Sonnet 5 with explicit high effort against effort omitted, on 30 AIME items: +$0.0103 per call and no detected accuracy difference.
- **Implication:** Effort semantics are specific to each model. Always set effort explicitly in the plan.

**2512.19585: Increasing the Thinking Budget is Not All You Need** (Iacobacci et al., 2025; 4 pages) [W].
- **Finding:** Self-consistency or reflection uses compute better than a bigger thinking budget.
- **Implication:** For high-stakes nodes, two independent runs at medium effort may beat one run at max.

---

## 5. Verification and cross-checking

**2203.11171: Self-Consistency** (Wang et al., ICLR 2023) [P].
- **Number (abs):** +17.9% on GSM8K, +11.0% on SVAMP, +12.2% on AQuA.
- **Implication:** Several independent attempts plus a vote make a strong, cheap check where the answer is discrete.

**2402.05120: More Agents Is All You Need** (Li et al., TMLR) [P].
- **Finding:** Performance from sampling and voting scales with the number of agents, and the gain correlates with task difficulty.
- **Implication:** Reserve redundancy for hard nodes.

**2310.01798: LLMs Cannot Self-Correct Reasoning Yet** (Huang et al., ICLR 2024) [P].
- **Finding:** Self-correction without external feedback fails and can make results worse.
- **Implication:** Verification needs an external signal: tests, tools, independent sources.

**2306.05685: Judging LLM-as-a-Judge** (Zheng et al., NeurIPS 2023 D&B) [P].
- **Finding:** GPT-4 judges agree with humans more than 80% of the time, but show position, verbosity and self-enhancement biases.

**2404.13076: LLM Evaluators Recognize and Favor Their Own Generations** (Panickssery, Bowman, Feng, 2024) [Pre].
- **Finding:** Self-recognition correlates linearly with self-preference.
- **Implication:** The verifier should not be the same session or prompt as the producer.

**2502.04313: Great Models Think Alike and this Undermines AI Oversight** (Goel et al., 2025) [Pre].
- **Finding (abs):** Judges favor models similar to themselves, and model mistakes become more similar as capability increases.
- **Implication:** Opus checking Sonnet's output shares many of Sonnet's blind spots. Diversify the evidence, not only the model.

**2609.10969: Engineering Reliable Commit Gates for Agentic AI** (Zheng et al., Sep 2026) [W].
- **Number (abs):** A vote across models over shared evidence approved 62.9% of unsafe proposals, against 22.9% with an independent evidence source. The source effect was 40.9 pp and model diversity 11.3 pp.
- **Implication:** Cross-verification must gather independent evidence: re-run tests, re-fetch sources, reproduce the result. A second model re-reading the same artifact is not enough.

**2609.25959: Calibration Is Not Verification (C-MoA)** (Rahali et al., Sep 2026) [W].
- **Number (abs):** Conformal filtering on agreement roughly doubles retained-claim precision, from 0.41 to 0.75. Going beyond consensus helps only when the verifier has domain knowledge. With a memory-only judge, the extra signals are near chance (AUC 0.531 and 0.511).
- **Implication:** Use agreement as a cheap filter. An adversarial check by Opus pays off only when Opus has tools or sources to consult.

**2504.01005: When To Solve, When To Verify** (Singhi et al., COLM 2025) [P].
- **Number (abs):** Self-consistency is more compute-efficient than generative verification at most budgets. Generative verification needs up to 8x the compute to match it.
- **Implication:** At normal budgets, prefer N independent attempts over an expensive verifier pass. Dedicated verification pays at high budgets or on high-stakes nodes.

**2407.18370: Trust or Escalate** (Jung, Brahman, Choi, 2024) [Pre].
- **Finding (abs):** Cascaded selective evaluation uses cheap judges first and escalates only when confidence is low.
- **Number (abs):** More than 80% guaranteed human agreement with about 80% coverage, using models as small as Mistral-7B, on a subset where GPT-4 alone rarely reaches 80%.
- **Implication:** Cascade the verification too: Haiku or Sonnet checks first, Opus only on low-confidence or high-stakes nodes.

**2311.17371: Should we be going MAD?** (Smit et al., 2023) [Pre].
- **Finding:** Multi-agent debate does not reliably beat self-consistency or ensembling, and is sensitive to hyperparameters.
- **Implication:** Don't use debate as the default check.

**2406.04692: Mixture-of-Agents** (Wang et al., 2024).
- **Number (abs):** 65.1% on AlpacaEval 2.0, against 57.5% for GPT-4o.

**2502.00674: Self-MoA** (Li et al., 2025) [Pre].
- **Number (abs):** Aggregating outputs from only the single best model beats mixing models: +6.6% on AlpacaEval 2.0 and +3.8% on average. Mixing models lowers average quality.
- **Implication:** When cross-checking, don't feed the weak tier's opinions into the strong tier's judgment. Quality beats diversity of opinions, while diversity of evidence still matters (see 2609.10969).

**2604.23178: Judging the Judges** (Soumik, TMLR 2026) [P].
- **Number (abs):** Gemini 2.5 Flash with debiasing reached 71.0% agreement at about $0.001 per evaluation. Claude Sonnet 4 reached 69.5% at about $0.015, so the cheaper setup was about 15x cheaper. Style bias dominates.
- **Implication:** A cheaper tier with a good rubric can do routine judging. Keep Opus for hard research and cross-verification of findings.

Also verified: **2305.14325 Multiagent Debate** (Du et al.). Debate improves factuality and reasoning, but see 2311.17371 for the caveats.

---

## 6. Anthropic and Claude Code primary docs relevant to implementation

**Models overview** [L, doc]. https://platform.claude.com/docs/en/models/overview
- **Prices per MTok, input/output:**

  | Model | Input | Output | Default effort |
  | --- | --- | --- | --- |
  | Fable 5.1 | $10 | $50 | high |
  | Opus 5.5 | $4 | $20 | medium |
  | Sonnet 5.5 | $2 | $10 | high |
  | Haiku 5.5 | from $0.10 | from $0.50 | medium |

- All four have a 1M-token context.
- Haiku 5.5's listed purpose: "for high-volume, latency-sensitive tasks such as classification, extraction, and routing".
- **Implication:** Opus 5.5 output costs only 2x Sonnet 5.5, while Sonnet costs 20x Haiku and Opus 40x Haiku. Economically, the decision that matters is whether to use Haiku. Erring upward from Sonnet to Opus is comparatively cheap; this is my arithmetic from list prices.

**Claude Haiku 5.5 page** [L, doc]. https://platform.claude.com/docs/en/models/haiku-5-5/overview
- Released 2026-10-07. "Built for ... classification, routing, extraction, and subagent tasks."
- Pricing: $0.10/$0.50 for prompts up to 100k tokens, and $0.50/$2.50 above 100k.
- The newer tokenizer counts about 30% more tokens than Haiku 4.5.
- Non-default temperature, top_p or top_k returns a 400 error.
- **Implication:** Keep router prompts under 100k tokens. Don't plan on sampling knobs; diversity has to come from separate calls.

**Effort docs** [L, doc]. https://platform.claude.com/docs/en/build-with-claude/effort
- Levels are low, medium, high, xhigh and max. Effort is "a behavioral signal, not a strict token budget". Lower effort means fewer and terser tool calls.
- `low`: "Simpler tasks ... such as subagents".
- `xhigh`: "Long-running agentic and coding tasks (over 30 minutes)".
- Haiku 5.5:
  - Start at medium.
  - Use low for chat and short tool tasks. Quote: "In long agent prompts, the model is more likely to skip a search, stop early, or skip a check at `low`."
  - Use high for knowledge work, longer agent tasks and strict instruction following.
  - Use xhigh or max only with evals, and compare against Sonnet 5.5.
- Sonnet 5.5: for agentic coding, start at medium on well-specified tasks and move to high for harder or longer ones.
- Opus 5.5: default is medium; run an effort sweep.
- Per-message effort is in beta and preserves the prompt cache.

**Claude Code subagents** [L, doc]. https://code.claude.com/docs/en/sub-agents
- Frontmatter supports:
  - `model`: sonnet, opus, haiku, fable, a full model ID, or inherit.
  - `effort`: low through max.
  - Also `tools`, `maxTurns`, `isolation: worktree` and `background`.
- Model resolution order: the per-invocation `model` parameter, then frontmatter, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main conversation's model.
- Subagents can nest up to 3 levels below the main conversation by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`).
- Results come back as summaries. "Running many subagents that each return detailed results can consume significant context."
- **Harness observation (not from the docs page):** In this session the Agent tool exposes both `model` and `effort` parameters. Its own description says to set `effort` only when the user, or instructions such as CLAUDE.md or a skill, explicitly ask. Implication for Skill B: the executor skill has to state the effort for each node explicitly, as an instruction, so the orchestrator is allowed to pass it.

---

## 7. Can Haiku 5.5 be the routing decision maker instead of an external routing API?

**Evidence for:**
- Anthropic positions Haiku 5.5 explicitly for routing and classification.
- Router quality is limited by information and roster, not router size:
  - Scaling the encoder from 0.5B to 72B gives about no gain (2609.34326).
  - A vanilla LLM router plus a statistics table matches trained routers (2606.22902).
  - A roster of 2-3 models carries nearly all the accuracy (2610.02762).
- Small models classify well against explicit policies (Arch-Router 1.5B, 2506.16655).
- LLM routers given model descriptors generalize to unseen models (2506.09033).
- A tiny LLM router works for handoff-format decisions (2608.25277).

**Evidence that external routing APIs are not worth it:** Six commercial routers did not beat random between two well-chosen models (2610.02762). Several routers emit nearly constant tiers (2608.14641). Commercial routers fail to beat a simple baseline reliably (2601.07206).

**Risks:**
- Overconfidence, which worsens partway through agentic tasks (2512.24661).
- Difficulty blindness and category shortcuts (2610.02762, 2504.07113).
- Small models vary widely in how well their confidence discriminates (2604.19781).
- Prompt injection that forces escalation (2501.01818).
- At low effort, Haiku may "skip a check" (effort docs).

**Recommended pattern.** This is my synthesis of the sources above.
1. The Opus or Fable planner does routing at plan time for the initial DAG, because it can see the dependencies (2609.32917, 2604.05164).
2. Use Haiku 5.5 at medium effort for incremental routing of new subtasks found during execution, especially when the orchestrator runs on Sonnet.
   - Its input is a fixed rubric, a table of tier capabilities and prices, and a log of recent outcomes.
   - Its output is constrained JSON: `{tier, effort, dims, reason_codes}`.
3. Run Haiku twice. If the two runs disagree, escalate one tier (DART-style agreement, 2606.23181).
4. Hard rules override the router:
   - Research and cross-verification nodes go to Opus.
   - Synthesis or terminal nodes go to at least Sonnet.
   - Subtasks derived from untrusted content are capped.
5. Prefer escalating on evidence over guessing difficulty: failed tests, disagreement, or a stalled partial trajectory (2607.00053, 2311.05772).
6. Benchmark the policy against fixed baselines: Always-Sonnet-medium, and frontier only on the synthesis node.

**Cost note (my arithmetic, inference):**
- A Haiku routing call with about 3k input and 200 output tokens costs roughly $0.0004.
- The same decision made inside an Opus 5.5 orchestrator's own reasoning costs about $0.006 in output tokens, which is also negligible.
- Spawning Haiku as the router therefore pays off mainly in three cases:
  - The orchestrator runs on a cheaper tier.
  - Many subtasks need triage in bulk.
  - The orchestrator's context should stay clean.
- Otherwise the planner or orchestrator should route inline.

---

## 8. Design rules

1. **Start simple.** Spawn subagents only for decomposable or parallel subtasks, or to isolate context. Stay single-agent when one agent is likely to succeed (about 45% or more), or when the task is sequential or depends on shared state. Sources: 2512.08296, 2604.02460, 2505.18286, 2610.06069, Anthropic-MA, Anthropic-BEA, Cognition.
2. **Keep the roster small and decisions coarse.** Use three tiers (Haiku, Sonnet, Opus), with Fable only on exception, and at most about three effort levels. Every policy must beat fixed baselines at matched cost: Always-Sonnet-medium, and frontier only on the synthesis node. Sources: 2610.02762, 2608.14641, 2601.07206, 2609.32917.
3. **Route at plan time with the whole DAG visible.** Score each node on capability dimensions (reasoning, code, debugging, tool use, knowledge) and pick the cheapest tier whose profile covers all of them. Allocate effort with the whole plan in view. Sources: 2609.32917, 2605.17106, 2312.04511, 2604.05164, 2602.03786.
4. **Give the router information, not just intelligence.** That means a tier capability and price table, outcome statistics by task type, and the recent failure history, with outcomes logged and fed back. This is what lets a cheap model such as Haiku match trained routers. Sources: 2606.22902, 2506.09033, 2609.34326, 2506.16655, 2512.24661.
5. **Escalate on evidence, not on guesses.** Probe with a cheap tier and escalate on failed tests, disagreement between two samples, or a stalled partial trajectory. When a node fails, decompose it further (ADaPT) instead of planning everything deeply up front. Sources: 2607.00053, 2310.12963, 2311.05772, 2606.23181, 2506.11578.
6. **Never trust self-reports.** Models are overconfident, and more so deeper into agentic tasks. Use sample agreement, tests and external checks as the gate. Sources: 2512.24661, 2306.13063, 2604.19781, 2310.01798.
7. **Plans flow downhill.** A strong model may plan for weak executors, never the reverse. Spend the top tier on knowledge-heavy research, hard reasoning and cross-verification, not on mechanical steps. Give cheap executors narrow roles and tier-specific instructions. Sources: 2506.11578, 2402.15000, 2305.18323, 2401.07324, 2609.34712, Anthropic-MA.
8. **Set effort per node, in both directions.**
   - Low for routine or mechanical work.
   - Medium as the default.
   - High for knowledge work or long agentic runs.
   - xhigh or max only for hard, long nodes with measured benefit.
   - Past a complexity threshold, decompose instead of raising effort.
   - Always set effort explicitly in the plan.
   Sources: effort docs, 2603.07915, 2508.13141, 2507.14417, 2503.15113, 2608.03169, 2608.16956.
9. **Write briefs as complete, curated contracts.** Each brief covers objective, inputs, constraints copied verbatim, authority (what the agent may touch), output schema, done criteria and budget. Send it in one message, without the orchestrator's transcript. Ask for at most about 2k tokens back plus file or artifact references. On escalation, pass a residual contract (done, decided, remaining). Sources: Anthropic-MA, Anthropic-CE, 2610.00041, 2608.29028, 2505.06120, 2609.09233, 2609.13800, 2605.27787, 2602.11865.
10. **Keep concurrency hygienic.**
    - At most about 3-5 subagents in parallel.
    - Disjoint write ownership, using worktrees for code.
    - No peer-to-peer chatter.
    - The orchestrator monitors, joins and owns integration.
    - Every node has explicit termination conditions and turn or token caps, which guards against over-spawning such as "50 subagents for a simple query".
    Sources: 2610.10263, 2512.08296, 2503.13657, 2410.02506, Anthropic-MA, Claude Code docs.
11. **Verify centrally, against the objective, with independent evidence.** Re-run tests, re-fetch sources, reproduce results. A second model re-reading the same artifact adds little because errors are correlated. Cascade the checks: cheap self-consistency or rubric checks first, and Opus cross-verification only on low-agreement or high-stakes nodes. Sources: 2609.10969, 2502.04313, 2404.13076, 2503.13657, 2407.18370, 2504.01005, 2609.25959.
12. **Measure cost-of-pass and keep a routing log.** Record task type, tier, effort, outcome and tokens for each run, and update the priors from it. Treat subtasks built from untrusted content as injection risks: no automatic escalation to Opus or Fable on their say-so. Sources: 2508.02694, 2606.22902, 2609.34712, 2501.01818.

---

## 9. Unverified or not confirmed

- **Numbers marked `full*` were not read in the PDF.** They came through the WebFetch summarizer reading arxiv.org HTML: 2512.08296 (45% threshold, error amplification, token overhead), 2610.10263 (tables and failure-mode percentages), 2503.13657 (prevalence and interventions), 2610.02762 (router names, γ values), 2606.22902 (Table 1 and Table 3 values), and 2506.11578 (COPE table). Spot-check them before quoting externally.
  - For MAST, the summarizer noted that the paper attributes the same +9.4% to two different interventions.
  - For Agent-as-a-Router, the comparison of the zero-shot router (Table 1) with trained routers (Table 3) is my cross-table inference; the authors do not state it.
  - Appendix C.1 / Table 7 (other zero-shot LLM routers) was not reached.
- **RouteLLM's 95% / 26% / 14% figures** come from the LMSYS blog. The PDF fetch returned binary, so the paper's tables were not read.
- **Claims the authors make without independent support:** AgentRouter's "60-80% of inference budget wasted" (2609.22951), and Planner-as-Router's "compounding penalty", which the authors themselves call a hypothesis.
- **Haiku 5.5:** no public benchmark numbers were verified. The announcement page, system card and "Prompting Claude Haiku 5.5" guide were not opened. Early web-search results claimed it was not yet released; the official docs list it as released on 2026-10-07, and that is what this report uses.
- **Claude Code sub-agents page:** the last roughly 7.5k characters were not read. A per-invocation `effort` parameter for the Agent tool was not found in the part that was read. It is reported only as observed in this session's tool schema.
- **Missing evidence:** no paper was found that directly compares a Haiku-class prompted router with a trained router on agentic tasks. The closest is 2606.22902, which uses Sonnet 4.6 as the zero-shot router.
- **Affiliations and venues not confirmed:** Google DeepMind affiliation for 2602.11865; the venue of 2505.00212 (the comment says only "camera-ready"); venues for RouteLLM and Trust or Escalate. Venues are given only where the arXiv comment names them.
- **Not opened (abstract or title only):** 2307.03172 Lost in the Middle (title verified only, not used); 2412.21187 (no headline number in the abstract; full text not read).
- **Lower evidence quality:** several 2026 sources are workshop papers, single-author reports or small-n studies, marked [W]. These are 2608.14641, 2609.32917, 2609.22951, 2610.00041, 2610.06069, 2609.10969, 2609.25959, 2604.19781, 2607.02436, 2608.03169, 2608.16956, 2601.04748 and 2512.19585. The rules above use them only as supporting evidence next to [P] or [L] sources.
