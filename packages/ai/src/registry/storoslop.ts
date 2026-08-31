import { createApiKeyLogin } from "./api-key-login";
import type { ProviderDefinition } from "./types";

/**
 * Storoslop login flow (API key paste, no network validation).
 *
 * The storoslop gateway is fork-private (`http://slop.storo.cloud:4000/v1`,
 * OpenAI chat-completions compatible), so there is no public "who am I"
 * endpoint to validate against from an arbitrary network position and the
 * key paste is accepted as-is. A wrong key surfaces on the first request.
 */
export const storoslopProvider = {
	id: "storoslop",
	name: "storoslop",
	login: createApiKeyLogin({
		providerLabel: "storoslop",
		promptMessage: "Paste your storoslop API key",
		placeholder: "sk-...",
		validation: null,
	}),
} as const satisfies ProviderDefinition;
