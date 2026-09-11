import { describe, expect, it } from "bun:test";
import { Effort, type FetchImpl } from "@oh-my-pi/pi-ai";
import { streamSimple } from "@oh-my-pi/pi-ai/stream";
import type { Context, Model } from "@oh-my-pi/pi-ai/types";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { STOROSLOP_STATIC_MODELS } from "@oh-my-pi/pi-catalog/provider-models/openai-compat";

// Locks the storoslop gateway's reasoning_effort contract for the bundled
// deepseek-v4.1-flash: the wire accepts low/high/xhigh/max, and thinking-off
// is sent as `reasoning_effort: "none"` (the gateway's documented disable
// value) rather than clamped to the lowest rung. minimal/medium remap onto the
// nearest supported rung.
// Each captured stream takes ~1.5s to settle; keep per-case timeouts generous.
const TEST_TIMEOUT_MS = 20_000;

const context: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

function storoslopFlash(): Model<"openai-completions"> {
	const spec = STOROSLOP_STATIC_MODELS.find(model => model.id === "deepseek-v4.1-flash");
	if (!spec) throw new Error("storoslop deepseek-v4.1-flash seed is missing");
	return buildModel(spec);
}

async function captureChatBody(
	model: Model<"openai-completions">,
	options: { reasoning?: Effort; disableReasoning?: boolean },
): Promise<{ reasoning_effort?: string; max_tokens?: number; max_completion_tokens?: number }> {
	let requestBody: string | undefined;
	const fetchMock: FetchImpl = (_input, init) => {
		requestBody = typeof init?.body === "string" ? init.body : undefined;
		return Promise.resolve(
			new Response(
				'data: {"choices":[{"delta":{"content":"ok"}}]}\ndata: {"choices":[{"finish_reason":"stop"}]}\ndata: [DONE]\n',
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			),
		);
	};
	const stream = streamSimple(model, context, { apiKey: "k", fetch: fetchMock, ...options });
	await stream.result();
	if (!requestBody) throw new Error("request body was not captured");
	return JSON.parse(requestBody);
}

describe("storoslop deepseek-v4.1-flash reasoning effort wire mapping", () => {
	it("exposes the low/high/xhigh/max ladder with thinking-off allowed", () => {
		const model = storoslopFlash();
		expect(model.thinking?.efforts).toEqual([Effort.Low, Effort.High, Effort.XHigh, Effort.Max]);
		expect(model.thinking?.defaultLevel).toBe(Effort.High);
		expect(model.thinking?.requiresEffort).toBeFalsy();
	});

	it.each([
		[Effort.Low, "low"],
		[Effort.High, "high"],
		[Effort.XHigh, "xhigh"],
		[Effort.Max, "max"],
	])(
		"sends wire-exact reasoning_effort for %s",
		async (effort, wire) => {
			expect((await captureChatBody(storoslopFlash(), { reasoning: effort })).reasoning_effort).toBe(wire);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"sends reasoning_effort none when thinking is off",
		async () => {
			const body = await captureChatBody(storoslopFlash(), { disableReasoning: true });
			expect(body.reasoning_effort).toBe("none");
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"omits reasoning_effort when no level is requested (gateway default)",
		async () => {
			const body = await captureChatBody(storoslopFlash(), {});
			expect(body.reasoning_effort).toBeUndefined();
		},
		TEST_TIMEOUT_MS,
	);

	it.each([
		[Effort.Minimal, "low"],
		[Effort.Medium, "high"],
	])(
		"remaps %s onto the nearest supported rung",
		async (effort, wire) => {
			expect((await captureChatBody(storoslopFlash(), { reasoning: effort })).reasoning_effort).toBe(wire);
		},
		TEST_TIMEOUT_MS,
	);

	it(
		"caps output through max_tokens, not max_completion_tokens",
		async () => {
			const body = await captureChatBody(storoslopFlash(), { reasoning: Effort.High });
			expect(body.max_completion_tokens).toBeUndefined();
			expect(typeof body.max_tokens).toBe("number");
		},
		TEST_TIMEOUT_MS,
	);
});
