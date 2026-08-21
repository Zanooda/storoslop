/**
 * Builtin `/autoprompt` slash command.
 *
 * Ported from Spielewoy/autoprompt-skill (MIT, Copyright 2026 Spielewoy);
 * statoslop-native adaptation. Parses the run controls, creates a fresh
 * governance root, records the mission, and seeds the L0 conductor turn.
 */

import type { SlashCommandRuntime, SlashCommandSpec } from "../slash-commands/types";
import { parseAutopromptArgs } from "./args";
import { appendGatewayArtifact, createRunState, PROMPTS_FILE } from "./governance";
import { buildAutopromptSeed } from "./orchestrator";

/** The single `/autoprompt` command spec (TUI and ACP share it). */
function createAutopromptSlashCommand(): SlashCommandSpec {
	return {
		name: "autoprompt",
		description: "Run an Autoprompt orchestration: roadmap, parallel lanes, review and verification",
		inlineHint: "[mode=tokensaver|wide|custom] [max_subs=N] <mission>",
		allowArgs: true,
		handle: async (command, runtime: SlashCommandRuntime) => {
			const parsed = parseAutopromptArgs(command.text);
			if ("error" in parsed) {
				await runtime.output(parsed.error);
				return { consumed: true };
			}
			const { mission, mode, maxSubs } = parsed;
			const state = await createRunState(mission);
			await appendGatewayArtifact(state.root, PROMPTS_FILE, `=== PROMPT 1 ===\n${mission}\n`);
			const promptText = buildAutopromptSeed({ state, mode, maxSubs }, mission);
			await runtime.output(`Autoprompt: created run ${state.root} (mode=${mode}, max_subs=${maxSubs})`);
			return { prompt: promptText };
		},
	};
}

/** The `/autoprompt` command list consumed by the builtin registry. */
export const BUILTIN_AUTOPROMPT_SLASH_COMMANDS: ReadonlyArray<SlashCommandSpec> = [createAutopromptSlashCommand()];
