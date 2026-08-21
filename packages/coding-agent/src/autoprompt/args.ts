/**
 * Autoprompt run-control argument parsing.
 *
 * Ported from Spielewoy/autoprompt-skill (MIT, Copyright 2026 Spielewoy);
 * statoslop-native adaptation of the `mode=`/`max_subs=` run controls.
 */

export type AutopromptMode = "tokensaver" | "wide" | "custom";

export interface ParseAutopromptArgsOk {
	mission: string;
	mode: AutopromptMode;
	maxSubs: number;
}

export type ParseAutopromptArgsResult = ParseAutopromptArgsOk | { error: string };

/** `tokensaver` (default) caps active subagents at six. */
export const TOKENSAVER_MAX_SUBS = 6;
/** `wide` (fallback ceiling when no provider concurrency is configured). */
export const WIDE_MAX_SUBS = 6;
/** Bounds for `mode=custom max_subs=N`. */
export const CUSTOM_MAX_SUBS_MIN = 1;
export const CUSTOM_MAX_SUBS_MAX = 16;

/**
 * Parse `/autoprompt` command text (after the "/autoprompt" token) into mission
 * plus resolved knobs.
 *
 * Accepts optional leading `mode=...` and `max_subs=N` tokens in any order.
 * `mode=custom` REQUIRES `max_subs=N`; `mode=tokensaver`/`wide` REJECT a
 * stray `max_subs`. Tokens left after stripping the handled knobs are the mission.
 */
export function parseAutopromptArgs(text: string): ParseAutopromptArgsResult {
	const tokens = text.trim().split(/\s+/).filter(Boolean);

	let mode: AutopromptMode | undefined;
	let maxSubs: number | undefined;
	const rest: string[] = [];

	for (const token of tokens) {
		if (token.startsWith("mode=")) {
			const value = token.slice("mode=".length);
			if (value === "tokensaver" || value === "wide" || value === "custom") {
				mode = value;
			} else {
				return { error: `Invalid mode: ${value}` };
			}
		} else if (token.startsWith("max_subs=")) {
			maxSubs = parseMaxSubs(token.slice("max_subs=".length));
			if (maxSubs === undefined) {
				return { error: `Invalid max_subs: ${token.slice("max_subs=".length)}` };
			}
		} else {
			rest.push(token);
		}
	}

	if (maxSubs !== undefined && (mode === undefined || mode === "tokensaver" || mode === "wide")) {
		return { error: "max_subs requires mode=custom" };
	}
	if (mode === "custom" && maxSubs === undefined) {
		return { error: "mode=custom requires max_subs=N" };
	}

	if (rest.length === 0) {
		return { error: "Usage: /autoprompt [mode=tokensaver|wide|custom] [max_subs=N] <mission>" };
	}

	const resolvedMode: AutopromptMode = mode ?? "tokensaver";
	const resolvedMaxSubs =
		resolvedMode === "custom" ? (maxSubs as number) : resolvedMode === "wide" ? WIDE_MAX_SUBS : TOKENSAVER_MAX_SUBS;

	return { mission: rest.join(" "), mode: resolvedMode, maxSubs: resolvedMaxSubs };
}

function parseMaxSubs(raw: string): number | undefined {
	if (!/^\d+$/.test(raw)) return undefined;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < CUSTOM_MAX_SUBS_MIN || n > CUSTOM_MAX_SUBS_MAX) return undefined;
	return n;
}
