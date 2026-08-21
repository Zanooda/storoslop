/**
 * Autoprompt L0 conductor instruction: composes the text that seeds an
 * autonomous orchestration turn.
 *
 * Ported from Spielewoy/autoprompt-skill (MIT, Copyright 2026 Spielewoy);
 * statoslop-native adaptation. The main agent becomes the L0 conductor and drives
 * the `ap-*` bundled subagents via the task tool.
 */

import * as path from "node:path";
import type { AutopromptMode } from "./args";
import type { AutopromptRunState } from "./governance";
import { PROMPTS_FILE, ROADMAP_FILE } from "./governance";

export interface AutopromptSeed {
	state: AutopromptRunState;
	mode: AutopromptMode;
	maxSubs: number;
}

const PERSONAS = [
	"ap-scope-coordinator",
	"ap-scoper",
	"ap-planner",
	"ap-feature-coordinator",
	"ap-manager",
	"ap-implementer",
	"ap-sweep-coordinator",
	"ap-sweeper",
	"ap-juror",
	"ap-arbiter",
	"ap-goal-checker",
	"ap-reviewer",
	"ap-fresh-verifier",
	"ap-verifier",
	"ap-janitor",
	"ap-intake",
	"ap-preflight-probe",
	"ap-depth-prober",
	"ap-execharness-resolver",
	"ap-re-anchor",
	"ap-researcher",
	"ap-synthesizer",
	"ap-scribe",
	"ap-framework-generator",
	"ap-framework-validator",
];

/**
 * Absolute path to the autoprompt doctrine, resolved from this module's own install
 * directory so it stays valid wherever the coding-agent is installed and used (never a
 * hard-coded repo-relative path the conductor would have to discover at run time).
 */
const SKILL_MD = path.join(import.meta.dir, "..", "prompts", "autoprompt", "skill.md");

/** The mission-pointer token block every brief verifies before acting. */
export function buildMissionPointerBlock(state: AutopromptRunState): string {
	return `path=${PROMPTS_FILE} hash=sha256:${state.promptsHash} bytes=${state.promptsBytes} nonce=${state.nonce}`;
}

/** The full text seeded into the session as the conductor turn. */
export function buildAutopromptSeed(seed: AutopromptSeed, mission: string): string {
	const { state, mode, maxSubs } = seed;
	const pointer = buildMissionPointerBlock(state);

	return `# Autoprompt run — L0 conductor

You are the L0 conductor of an Autoprompt orchestration run (ported from Spielewoy/autoprompt-skill, MIT). Invoked explicitly with a mission. Execute it now.

Mission:
${mission}

Governance (never the working tree): ${state.root}
Mission pointer: ${pointer}

Ledgers:
- Write this mission to \`${state.root}/${PROMPTS_FILE}\` if absent (append-only).
- Produce one canonical roadmap at \`${state.root}/${ROADMAP_FILE}\` and record each wave in \`GATELOG.md\`.
- Zero governance writes in the working tree.

Dispatch with the task tool. Bind \`agent\` to one registered ap-* persona for every dispatch: ${PERSONAS.join(", ")}. Every brief carries the verified mission pointer above and includes its <150-word report rule. A worker never loads or re-invokes the Autoprompt skill; no nested run; no recursion. Collect-then-stop; leave no live agent idling.

Run controls this run: mode=${mode} max_subs=${maxSubs}.

Loop:
1. Frontier check: read only the GATELOG tail (or start a fresh root). No active frontier → report status and stop.
2. Scope wave: dispatch \`ap-scope-coordinator\` → \`ap-scoper\` authors the roadmap; then \`ap-reviewer\` + \`ap-fresh-verifier\` concurrently. Bounded missions use the 3-agent/2-round topology. Freeze the roadmap on joint approval; on rejection repair only named items.
3. Lane waves: dispatch per dependency/launch group — through \`ap-manager\` for a multi-lane slice, else \`ap-feature-coordinator\` → \`ap-implementer\` directly for a single bounded lane. Dispatch every ready lane before collecting any.
4. Lane verification: \`ap-reviewer\` + \`ap-fresh-verifier\` concurrently; one \`ap-implementer\` repair round per lane on a concrete failing repro, then re-verify once.
5. Convergence: \`ap-sweep-coordinator\` → \`ap-sweeper\` + \`ap-juror\` (→ \`ap-arbiter\` on technical forks) → \`ap-goal-checker\` (final acceptance) → \`ap-janitor\` only when enabled → ledger validation.
6. Verdict: \`Autoprompt DONE: <n> lanes <status>\` or \`FAILED: <numbered reasons>\`, plus the governance root path.

The full orchestration doctrine (start contract, hierarchy, dispatch rules, TDD/build contract, DONE gate) lives in \`${SKILL_MD}\`; execute from that when a lane or verdict runs, and apply its rules verbatim.

Do not commit, push, publish, deploy, spend money, or clean the working tree without explicit user authorization for that action.`;
}
