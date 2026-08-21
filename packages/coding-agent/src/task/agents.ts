/**
 * Bundled agent definitions.
 *
 * Agents are embedded at build time via Bun's import with { type: "text" }.
 */
import { Effort } from "@oh-my-pi/pi-ai";
import { parseFrontmatter, prompt } from "@oh-my-pi/pi-utils";
import { parseAgentFields } from "../discovery/helpers";
import apArbiterMd from "../prompts/agents/autoprompt/ap-arbiter.md" with { type: "text" };
import apDepthProberMd from "../prompts/agents/autoprompt/ap-depth-prober.md" with { type: "text" };
import apExecharnessResolverMd from "../prompts/agents/autoprompt/ap-execharness-resolver.md" with { type: "text" };
import apFeatureCoordinatorMd from "../prompts/agents/autoprompt/ap-feature-coordinator.md" with { type: "text" };
import apFrameworkGeneratorMd from "../prompts/agents/autoprompt/ap-framework-generator.md" with { type: "text" };
import apFrameworkValidatorMd from "../prompts/agents/autoprompt/ap-framework-validator.md" with { type: "text" };
import apFreshVerifierMd from "../prompts/agents/autoprompt/ap-fresh-verifier.md" with { type: "text" };
import apGoalCheckerMd from "../prompts/agents/autoprompt/ap-goal-checker.md" with { type: "text" };
import apImplementerMd from "../prompts/agents/autoprompt/ap-implementer.md" with { type: "text" };
import apIntakeMd from "../prompts/agents/autoprompt/ap-intake.md" with { type: "text" };
import apJanitorMd from "../prompts/agents/autoprompt/ap-janitor.md" with { type: "text" };
import apJurorMd from "../prompts/agents/autoprompt/ap-juror.md" with { type: "text" };
import apManagerMd from "../prompts/agents/autoprompt/ap-manager.md" with { type: "text" };
import apPlannerMd from "../prompts/agents/autoprompt/ap-planner.md" with { type: "text" };
import apPreflightProbeMd from "../prompts/agents/autoprompt/ap-preflight-probe.md" with { type: "text" };
import apReAnchorMd from "../prompts/agents/autoprompt/ap-re-anchor.md" with { type: "text" };
import apResearcherMd from "../prompts/agents/autoprompt/ap-researcher.md" with { type: "text" };
import apReviewerMd from "../prompts/agents/autoprompt/ap-reviewer.md" with { type: "text" };
import apScopeCoordinatorMd from "../prompts/agents/autoprompt/ap-scope-coordinator.md" with { type: "text" };
import apScoperMd from "../prompts/agents/autoprompt/ap-scoper.md" with { type: "text" };
import apScribeMd from "../prompts/agents/autoprompt/ap-scribe.md" with { type: "text" };
import apSweepCoordinatorMd from "../prompts/agents/autoprompt/ap-sweep-coordinator.md" with { type: "text" };
import apSweeperMd from "../prompts/agents/autoprompt/ap-sweeper.md" with { type: "text" };
import apSynthesizerMd from "../prompts/agents/autoprompt/ap-synthesizer.md" with { type: "text" };
import apVerifierMd from "../prompts/agents/autoprompt/ap-verifier.md" with { type: "text" };
import designerMd from "../prompts/agents/designer.md" with { type: "text" };
// Embed agent markdown files at build time
import agentFrontmatterTemplate from "../prompts/agents/frontmatter.md" with { type: "text" };
import librarianMd from "../prompts/agents/librarian.md" with { type: "text" };
import reviewerMd from "../prompts/agents/reviewer.md" with { type: "text" };
import scoutMd from "../prompts/agents/scout.md" with { type: "text" };
import securityReviewerMd from "../prompts/agents/security-reviewer.md" with { type: "text" };
import taskMd from "../prompts/agents/task.md" with { type: "text" };
import { AUTO_THINKING } from "../thinking";

import type { AgentDefinition, AgentSource } from "./types";

interface AgentFrontmatter {
	name: string;
	description: string;
	tools?: string[];
	spawns?: string;
	model?: string | string[];
	thinkingLevel?: string;
	blocking?: boolean;
	prewalk?: boolean | string;
	advisor?: boolean | string;
}

interface EmbeddedAgentDef {
	fileName: string;
	frontmatter?: AgentFrontmatter;
	template: string;
}

function buildAgentContent(def: EmbeddedAgentDef): string {
	const body = prompt.render(def.template);
	if (!def.frontmatter) return body;
	return prompt.render(agentFrontmatterTemplate, { ...def.frontmatter, body });
}

const EMBEDDED_AGENT_DEFS: EmbeddedAgentDef[] = [
	{ fileName: "scout.md", template: scoutMd },
	{ fileName: "designer.md", template: designerMd },
	{ fileName: "reviewer.md", template: reviewerMd },
	{ fileName: "security-reviewer.md", template: securityReviewerMd },
	{ fileName: "librarian.md", template: librarianMd },
	{
		fileName: "task.md",
		frontmatter: {
			name: "task",
			description: "General-purpose subagent with full capabilities for delegated multi-step tasks",
			spawns: "*",
			model: "@task",
			thinkingLevel: AUTO_THINKING,
			// No `prewalk` frontmatter: the generic task hand-off (strong model
			// plans, then hands off to the smol role) is armed by the
			// `task.prewalk` setting (default off) or per agent via /agents
			// (task.agentPrewalk).
		},
		template: taskMd,
	},
	{
		fileName: "sonic.md",
		frontmatter: {
			name: "sonic",
			description: "Low-reasoning agent for strictly mechanical updates or data collection only",
			model: "@smol",
			thinkingLevel: Effort.Medium,
		},
		template: taskMd,
	},
	// Autoprompt personas (ported from Spielewoy/autoprompt-skill, MIT, Copyright 2026 Spielewoy).
	{ fileName: "autoprompt/ap-arbiter.md", template: apArbiterMd },
	{ fileName: "autoprompt/ap-depth-prober.md", template: apDepthProberMd },
	{ fileName: "autoprompt/ap-execharness-resolver.md", template: apExecharnessResolverMd },
	{ fileName: "autoprompt/ap-feature-coordinator.md", template: apFeatureCoordinatorMd },
	{ fileName: "autoprompt/ap-framework-generator.md", template: apFrameworkGeneratorMd },
	{ fileName: "autoprompt/ap-framework-validator.md", template: apFrameworkValidatorMd },
	{ fileName: "autoprompt/ap-fresh-verifier.md", template: apFreshVerifierMd },
	{ fileName: "autoprompt/ap-goal-checker.md", template: apGoalCheckerMd },
	{ fileName: "autoprompt/ap-implementer.md", template: apImplementerMd },
	{ fileName: "autoprompt/ap-intake.md", template: apIntakeMd },
	{ fileName: "autoprompt/ap-janitor.md", template: apJanitorMd },
	{ fileName: "autoprompt/ap-juror.md", template: apJurorMd },
	{ fileName: "autoprompt/ap-manager.md", template: apManagerMd },
	{ fileName: "autoprompt/ap-planner.md", template: apPlannerMd },
	{ fileName: "autoprompt/ap-preflight-probe.md", template: apPreflightProbeMd },
	{ fileName: "autoprompt/ap-re-anchor.md", template: apReAnchorMd },
	{ fileName: "autoprompt/ap-researcher.md", template: apResearcherMd },
	{ fileName: "autoprompt/ap-reviewer.md", template: apReviewerMd },
	{ fileName: "autoprompt/ap-scope-coordinator.md", template: apScopeCoordinatorMd },
	{ fileName: "autoprompt/ap-scoper.md", template: apScoperMd },
	{ fileName: "autoprompt/ap-scribe.md", template: apScribeMd },
	{ fileName: "autoprompt/ap-sweep-coordinator.md", template: apSweepCoordinatorMd },
	{ fileName: "autoprompt/ap-sweeper.md", template: apSweeperMd },
	{ fileName: "autoprompt/ap-synthesizer.md", template: apSynthesizerMd },
	{ fileName: "autoprompt/ap-verifier.md", template: apVerifierMd },
];

// Computed lazily on first loadBundledAgents() call to avoid eager prompt.render at module load.

export class AgentParsingError extends Error {
	constructor(
		error: Error,
		readonly source?: unknown,
	) {
		super(`Failed to parse agent: ${error.message}`, { cause: error });
		this.name = "AgentParsingError";
	}

	override toString(): string {
		const details: string[] = [this.message];
		if (this.source !== undefined) {
			details.push(`Source: ${JSON.stringify(this.source)}`);
		}
		if (this.cause && typeof this.cause === "object" && "stack" in this.cause && this.cause.stack) {
			details.push(`Stack:\n${this.cause.stack}`);
		} else if (this.stack) {
			details.push(`Stack:\n${this.stack}`);
		}
		return details.join("\n\n");
	}
}

/**
 * Parse an agent from embedded content.
 */
export function parseAgent(
	filePath: string,
	content: string,
	source: AgentSource,
	level: "fatal" | "warn" | "off" = "fatal",
): AgentDefinition {
	const { frontmatter, body } = parseFrontmatter(content, {
		location: filePath,
		level,
	});
	const fields = parseAgentFields(frontmatter);
	if (!fields) {
		throw new AgentParsingError(new Error(`Invalid agent field: ${filePath}\n${content}`), filePath);
	}
	return {
		...fields,
		systemPrompt: body,
		source,
		filePath,
	};
}

/** Cache for bundled agents */
let bundledAgentsCache: AgentDefinition[] | null = null;

/**
 * Load all bundled agents from embedded content.
 * Results are cached after first load.
 */
export function loadBundledAgents(): AgentDefinition[] {
	if (bundledAgentsCache !== null) {
		return bundledAgentsCache;
	}
	bundledAgentsCache = EMBEDDED_AGENT_DEFS.map(def =>
		parseAgent(`embedded:${def.fileName}`, buildAgentContent(def), "bundled"),
	);
	return bundledAgentsCache;
}

/**
 * Get a bundled agent by name.
 */
export function getBundledAgent(name: string): AgentDefinition | undefined {
	return loadBundledAgents().find(a => a.name === name);
}

/**
 * Get all bundled agents as a map keyed by name.
 */
export function getBundledAgentsMap(): Map<string, AgentDefinition> {
	const map = new Map<string, AgentDefinition>();
	for (const agent of loadBundledAgents()) {
		map.set(agent.name, agent);
	}
	return map;
}

/**
 * Clear the bundled agents cache (for testing).
 */
export function clearBundledAgentsCache(): void {
	bundledAgentsCache = null;
}

// Re-export for backward compatibility
export const BUNDLED_AGENTS = loadBundledAgents;
