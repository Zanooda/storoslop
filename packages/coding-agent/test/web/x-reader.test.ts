import { afterEach, describe, expect, it, vi } from "bun:test";
import { handleTwitter } from "@oh-my-pi/pi-coding-agent/web/scrapers/twitter";
import { parseXUrl, type XTarget } from "@oh-my-pi/pi-coding-agent/web/x";

// Fork note: upstream executes X reads through Grok's `x_search` tool, which
// requires `xai`/`xai-oauth` chat models in the `web` role pool. The storoslop
// fork is single-provider — `ModelRegistry.getAvailable` admits only the
// synthetic `web` search provider and `storoslop` — so the xAI-backed read
// path is unreachable here and its tests are pruned. The URL classifier and
// the "explain how to enable X reads" fallback are provider-independent and
// stay covered.

describe("parseXUrl", () => {
	it.each<[string, XTarget | null]>([
		["https://x.com/jack/status/20/photo/1", { kind: "post", id: "20" }],
		["https://twitter.com/i/web/status/20", { kind: "post", id: "20" }],
		["https://mobile.x.com/jack", { kind: "profile", handle: "jack", tab: "posts" }],
		["https://x.com/jack/with_replies", { kind: "profile", handle: "jack", tab: "replies" }],
		["https://x.com/search?q=omp%20tern&f=live", { kind: "search", query: "omp tern", latest: true }],
		["https://x.com/search?q=omp&f=media", { kind: "search", query: "omp filter:media", latest: true }],
		["https://x.com/search?q=can&f=user", { kind: "users", query: "can" }],
		["https://x.com/hashtag/rustlang", { kind: "search", query: "#rustlang", latest: false }],
		["https://x.com/home", { kind: "unsupported" }],
		["https://x.com/jack/followers", { kind: "unsupported" }],
		["https://developer.x.com/en/docs", null],
		["https://example.com/jack/status/20", null],
	])("classifies %s", (url, target) => {
		expect(parseXUrl(url)).toEqual(target);
	});
});

describe("handleTwitter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("explains how to enable X reads instead of scraping when no xAI model is available", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await handleTwitter("https://x.com/jack/status/20", 10);

		expect(result?.method).toBe("x-unavailable");
		expect(result?.content).toContain("xai-oauth");
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
