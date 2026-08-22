/**
 * Tests for plan mode thinking level propagation.
 *
 * Bug: When entering plan mode, the thinking level configured on the plan role
 * (e.g., "storoslop/slop-v3:xhigh") is discarded. resolveRoleModel()
 * calls resolveModelRoleValue() but only returns .model, dropping the thinking level.
 * #applyPlanModeModel() therefore has no thinking level to apply.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as path from "node:path";
import { Agent, ThinkingLevel } from "@oh-my-pi/pi-agent-core";
import { Effort } from "@oh-my-pi/pi-ai";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { AgentSession } from "@oh-my-pi/pi-coding-agent/session/agent-session";
import { AuthStorage } from "@oh-my-pi/pi-coding-agent/session/auth-storage";
import { SessionManager } from "@oh-my-pi/pi-coding-agent/session/session-manager";
import { TempDir } from "@oh-my-pi/pi-utils";

describe("plan mode thinking level", () => {
	let session: AgentSession;
	let modelRegistry: ModelRegistry;
	let authStorage: AuthStorage;
	let sessionSettings: Settings;
	let sharedDir: TempDir;

	beforeAll(async () => {
		authStorage = await AuthStorage.create(":memory:");
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		sharedDir = TempDir.createSync("@plan-mode-thinking-");
		// Fork: storoslop is the only selectable provider; configure it via models.yml.
		await Bun.write(
			path.join(sharedDir.path(), "models.yml"),
			JSON.stringify({
				providers: {
					storoslop: {
						baseUrl: "http://slop.storo.cloud/v1",
						apiKey: "TEST_KEY",
						api: "openai-completions",
						models: [
							{
								id: "slop-v3",
								name: "slop-v3",
								reasoning: true,
								thinking: {
									mode: "budget",
									efforts: [Effort.Minimal, Effort.Low, Effort.Medium, Effort.High, Effort.XHigh, Effort.Max],
								},
								input: ["text"],
								cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
								contextWindow: 100000,
								maxTokens: 8000,
							},
						],
					},
				},
			}),
		);
		modelRegistry = new ModelRegistry(authStorage, path.join(sharedDir.path(), "models.yml"));
		sessionSettings = Settings.isolated();
		const sonnet = modelRegistry.find("storoslop", "slop-v3");
		if (!sonnet) throw new Error("Expected slop-v3 to exist in registry");
		session = new AgentSession({
			agent: new Agent({
				initialState: { model: sonnet, systemPrompt: ["Test"], tools: [], messages: [] },
			}),
			sessionManager: SessionManager.inMemory(),
			settings: sessionSettings,
			modelRegistry,
		});
	});

	afterAll(async () => {
		await session.dispose();
		authStorage.close();
		sharedDir.removeSync();
	});

	function configureRoles(modelRoles: Record<string, string>): AgentSession {
		sessionSettings.override("modelRoles", modelRoles);
		return session;
	}

	describe("resolveRoleModelWithThinking", () => {
		it("returns thinking level when plan role includes a thinking suffix", () => {
			configureRoles({ plan: "storoslop/slop-v3:xhigh" });

			const result = session.resolveRoleModelWithThinking("plan");

			expect(result.model).toBeDefined();
			expect(result.model!.provider).toBe("storoslop");
			expect(result.model!.id).toBe("slop-v3");
			expect(result.thinkingLevel).toBe(ThinkingLevel.XHigh);
			expect(result.explicitThinkingLevel).toBe(true);
		});

		it("returns no explicit thinking level when plan role has no thinking suffix", () => {
			configureRoles({ plan: "storoslop/slop-v3" });

			const result = session.resolveRoleModelWithThinking("plan");

			expect(result.model).toBeDefined();
			expect(result.model!.id).toBe("slop-v3");
			expect(result.explicitThinkingLevel).toBe(false);
		});

		it("returns no model when no plan role is configured", () => {
			configureRoles({});

			const result = session.resolveRoleModelWithThinking("plan");

			expect(result.model).toBeUndefined();
		});

		it("returns thinking level for different levels", () => {
			configureRoles({ plan: "storoslop/slop-v3:high" });

			const result = session.resolveRoleModelWithThinking("plan");
			expect(result.thinkingLevel).toBe(ThinkingLevel.High);
			expect(result.explicitThinkingLevel).toBe(true);
		});

		it("works with the default role", () => {
			configureRoles({ default: "storoslop/slop-v3:medium" });

			const result = session.resolveRoleModelWithThinking("default");
			expect(result.model!.id).toBe("slop-v3");
			expect(result.thinkingLevel).toBe(ThinkingLevel.Medium);
			expect(result.explicitThinkingLevel).toBe(true);
		});

		it("resolveRoleModel still returns just the model (backward compat)", () => {
			configureRoles({ plan: "storoslop/slop-v3:xhigh" });

			const model = session.resolveRoleModel("plan");
			expect(model).toBeDefined();
			expect(model!.provider).toBe("storoslop");
			expect(model!.id).toBe("slop-v3");
		});
	});
});
