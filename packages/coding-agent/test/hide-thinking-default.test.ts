import { describe, expect, it, vi } from "bun:test";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { InputController } from "@oh-my-pi/pi-coding-agent/modes/controllers/input-controller";
import type { InteractiveModeContext } from "@oh-my-pi/pi-coding-agent/modes/types";
import { cfgHideThinkingBlock } from "@oh-my-pi/pi-coding-agent/session/settings";

describe("hideThinkingBlock default", () => {
	it("hides thinking blocks in a fresh session with no user config", () => {
		// The user-visible contract: an unconfigured session starts hidden.
		expect(cfgHideThinkingBlock.get(Settings.isolated())).toBe(true);
	});

	it("lets an explicit user value win over the default", () => {
		expect(cfgHideThinkingBlock.get(Settings.isolated({ hideThinkingBlock: false }))).toBe(false);
		expect(cfgHideThinkingBlock.get(Settings.isolated({ hideThinkingBlock: true }))).toBe(true);
	});

	it("reveals and re-hides thinking when the user toggles visibility", () => {
		const settings = Settings.isolated();
		// Interactive context seeded from the registry, as InteractiveMode loads it at startup.
		const ctx = {
			hideThinkingBlock: cfgHideThinkingBlock.get(settings),
			settings,
			// Thinking is on, so the visibility toggle is allowed to flip.
			session: { agent: { hideThinkingSummary: false }, thinkingLevel: "high" },
			chatContainer: { children: [], clear: vi.fn(), addChild: vi.fn(), resetStableEmission: vi.fn() },
			streamingComponent: undefined,
			streamingMessage: undefined,
			showStatus: vi.fn(),
			ui: { resetDisplay: vi.fn() },
			// Toggle is allowed to flip because thinking is on; it never reads
			// effectiveHideThinkingBlock, only ctx.hideThinkingBlock.
			hasDisplayableThinkingContent: false,
		} as unknown as InteractiveModeContext;
		const controller = new InputController(ctx);

		// Fresh session: hidden. Toggling reveals thinking traces.
		expect(ctx.hideThinkingBlock).toBe(true);
		controller.toggleThinkingBlockVisibility();
		expect(ctx.hideThinkingBlock).toBe(false);
		expect(cfgHideThinkingBlock.get(settings)).toBe(false);
		expect(ctx.showStatus).toHaveBeenCalledWith("Thinking blocks: visible");

		// Toggling again hides them once more.
		controller.toggleThinkingBlockVisibility();
		expect(ctx.hideThinkingBlock).toBe(true);
		expect(cfgHideThinkingBlock.get(settings)).toBe(true);
		expect(ctx.showStatus).toHaveBeenCalledWith("Thinking blocks: hidden");
	});
});
