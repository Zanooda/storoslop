/**
 * Bundled storoslop provider/model definition.
 *
 * The storoslop fork is single-provider: this tool only talks to the bundled
 * "storoslop" provider. The provider itself (baseUrl, api, models, compat) lives
 * here so both the setup wizard (which persists it to models.yml together with the
 * user's API key) and the model registry (which merges the bundled models into an
 * already-configured provider at read time) share one source of truth, sans the key.
 */

export const STOROSLOP_PROVIDER = "storoslop";
export const STOROSLOP_BASE_URL = "http://slop.storo.cloud:4000/v1";

export interface StoroslopModelDef {
	id: string;
	name: string;
	reasoning: boolean;
	supportsTools: boolean;
	input: string[];
	contextWindow: number;
	maxTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
	};
	compat: {
		reasoningContentField: string;
		extraBody: Record<string, unknown>;
	};
}

export interface StoroslopProviderConfig {
	baseUrl: string;
	api: string;
	apiKey: string;
	models: StoroslopModelDef[];
}

export interface StoroslopModelsConfig {
	providers?: Record<string, StoroslopProviderConfig>;
}

/** The bundled storoslop model list, sans API key/baseUrl. */
export const STOROSLOP_BUNDLED_MODELS: StoroslopModelDef[] = [
	{
		id: "deepseek-v4-flash",
		name: "deepseek-v4-flash",
		reasoning: true,
		supportsTools: true,
		input: ["text"],
		contextWindow: 1048576,
		maxTokens: 32768,
		cost: { input: 0.22, output: 0.66, cacheRead: 0.007, cacheWrite: 0 },
		compat: {
			reasoningContentField: "reasoning",
			extraBody: {
				chat_template_kwargs: {
					thinking: true,
					reasoning_effort: "high",
				},
			},
		},
	},
	{
		id: "qwen3.8",
		name: "qwen3.8",
		reasoning: true,
		supportsTools: true,
		input: ["text"],
		contextWindow: 262144,
		maxTokens: 32768,
		cost: { input: 0.22, output: 0.66, cacheRead: 0.007, cacheWrite: 0 },
		compat: {
			reasoningContentField: "reasoning",
			extraBody: {
				chat_template_kwargs: {
					thinking: true,
					reasoning_effort: "high",
				},
			},
		},
	},
];

/** The bundled storoslop provider/model definition, minus the API key. */
export function storoslopProvider(apiKey: string): StoroslopProviderConfig {
	return {
		baseUrl: STOROSLOP_BASE_URL,
		api: "openai-completions",
		apiKey,
		models: STOROSLOP_BUNDLED_MODELS,
	};
}
