# Autoprompt

Useful-first orchestration loop (ported from Spielewoy/autoprompt-skill, MIT, Copyright 2026 Spielewoy). Invoke only when invoked explicitly via `/autoprompt` (or a plain-language request that names autoprompt). Turn one mission into one executable roadmap, dispatch dependency-safe lanes as parallel `ap-*` subagents, and verify each result with independent reviewers and a blind fresh verifier.

## Start contract

Loading or invoking without a mission never starts a run. Bare `/autoprompt` performs only the frontier check — read only the tail of `GATELOG.md` — reports status, and stops. Never infer invocation from requests that never name autoprompt. Never resume without an explicit resume instruction.

Run controls: `mode=tokensaver` (default; active cap 6), `mode=wide` (all ready disjoint work up to the ceiling), `mode=custom max_subs=N`. Resolve only the undefined knobs; never re-scope the mission.

## Hierarchy

- **L0 conductor** starts the run and reports the end verdict. It dispatches only the L1 coordinators, never a manager or worker directly.
- **L1 coordinators** (`ap-scope-coordinator`, `ap-feature-coordinator`, `ap-sweep-coordinator`) own one phase and dispatch only. Each dispatches one `ap-manager` per multi-feature slice, or named L3 workers directly on a single bounded lane.
- **L2 manager** coordinates a multi-lane slice: it never implements.
- **L3 executors** (`ap-scoper`, `ap-planner`, `ap-implementer`, `ap-researcher`, `ap-synthesizer`, `ap-scribe`, `ap-sweeper`, `ap-framework-generator`, `ap-framework-validator`) do the real work.
- **L4 assurance leaves** (`ap-reviewer`, `ap-fresh-verifier`, `ap-verifier`, `ap-juror`, `ap-arbiter`, `ap-goal-checker`, `ap-depth-prober`, `ap-re-anchor`, `ap-execharness-resolver`) judge independently, blind to the author's self-claims; blind reviewers never read one another's verdicts. `ap-intake` and `ap-preflight-probe` are diagnostic/legacy only. `ap-janitor` finalizes a completed run, only when enabled.

## Dispatch

Dispatch ready disjoint work concurrently (spawn-then-collect). Bind the intended persona's registered name as the agent type. Send only role, objective, owned boundary, dependencies, acceptance criteria, roadmap section pointer/hash, pointer to required output/artifact path, and resolved model/effort status. Collect-then-stop: stop each agent once its final report is collected; a finished agent never idles against the live ceiling. A worker never loads or re-invokes the Autoprompt skill and never starts a nested run.

Every brief verifies a mission pointer before acting; a mismatch is `INVALID-BRIEF`. Governance artifacts (`PROMPTS.txt`, `ROADMAP.md`, `GATELOG.md`, run metadata) live only in the governance root, never inside the target repository.

## Build and verification

L3 implementation uses strict TDD: failing test first, confirm it fails for the right reason, minimal code to green, and real test runs — no mocks of the system under test. Coverage must reach >=95% on changed lines. Reuse evidence; rerun only incomplete or rejected gates. Do not commit, push, publish, deploy, spend money, or clean the working tree without explicit authorization.

DONE requires every roadmap item delivered, zero open findings, no pre-existing green-to-red regressions, >=95% changed-line coverage, a real end-to-end exercise, successful ledger validation, zero live subagents, and janitor completion when enabled.

## Git and external actions

Verification and ledger recording do not imply publication authority.
