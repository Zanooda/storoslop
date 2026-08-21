import { describe, expect, it } from "bun:test";
import { parseAutopromptArgs, TOKENSAVER_MAX_SUBS, WIDE_MAX_SUBS } from "../src/autoprompt/args";

describe("parseAutopromptArgs", () => {
	it("defaults to tokensaver with the mission as the remaining text and cap 6", () => {
		expect(parseAutopromptArgs("make the git wrapper unit-tested")).toEqual({
			mission: "make the git wrapper unit-tested",
			mode: "tokensaver",
			maxSubs: TOKENSAVER_MAX_SUBS,
		});
	});

	it("parses mode=tokensaver and mode=wide with an implicit cap", () => {
		expect(parseAutopromptArgs("mode=tokensaver fix the race")).toEqual({
			mission: "fix the race",
			mode: "tokensaver",
			maxSubs: TOKENSAVER_MAX_SUBS,
		});
		expect(parseAutopromptArgs("mode=wide build the booking flow")).toEqual({
			mission: "build the booking flow",
			mode: "wide",
			maxSubs: WIDE_MAX_SUBS,
		});
	});

	it("parses mode=custom max_subs=N and accepts the allowed bounds", () => {
		expect(parseAutopromptArgs("mode=custom max_subs=4 migrate every model")).toEqual({
			mission: "migrate every model",
			mode: "custom",
			maxSubs: 4,
		});
		const caps16 = parseAutopromptArgs("max_subs=16 mode=custom migrate every model");
		if (!("error" in caps16)) {
			expect(caps16.mode).toBe("custom");
			expect(caps16.maxSubs).toBe(16);
		}
	});

	it("rejects an invalid mode value", () => {
		const result = parseAutopromptArgs("mode=ultra do everything");
		expect("error" in result).toBe(true);
	});

	it("rejects a max_subs outside 1..16", () => {
		const result = parseAutopromptArgs("mode=custom max_subs=0 x");
		expect("error" in result).toBe(true);
		expect("error" in parseAutopromptArgs("mode=custom max_subs=100 x")).toBe(true);
	});

	it("rejects mode=custom without max_subs, and max_subs without mode=custom", () => {
		expect("error" in parseAutopromptArgs("mode=custom no cap")).toBe(true);
		expect("error" in parseAutopromptArgs("max_subs=4 tokensaver no cap")).toBe(true);
	});

	it("rejects an empty mission (bare /autoprompt)", () => {
		expect("error" in parseAutopromptArgs("")).toBe(true);
		expect("error" in parseAutopromptArgs("mode=tokensaver")).toBe(true);
	});
});
