import { describe, expect, it } from "bun:test";
import type { AutopromptRunState } from "../src/autoprompt/governance";
import { buildAutopromptSeed } from "../src/autoprompt/orchestrator";

const state: AutopromptRunState = {
	root: "/tmp/autoprompt-run-root",
	promptsHash: "0".repeat(64),
	promptsBytes: 17,
	nonce: "0000000000000000",
};

describe("buildAutopromptSeed", () => {
	it("embeds the real skill.md doctrine text in memory (no filesystem path)", () => {
		const seed = buildAutopromptSeed({ state, mode: "tokensaver", maxSubs: 6 }, "mission");

		// The doctrine is carried in the seed itself, not referenced by a path the
		// conductor would have to read from disk (unreachable inside bun --compile).
		expect(seed).toContain("Useful-first orchestration loop");
		expect(seed).not.toMatch(/prompts\/autoprompt\/skill\.md/);
		expect(seed).not.toContain("$bunfs");
	});
});
