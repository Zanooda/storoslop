/**
 * PRUNED — fork-restricted feature.
 *
 * This regression test (issue #9967) verified that `pickDefaultAvailableModel`
 * prefers a provider with *concrete* auth (an Anthropic API key, a dedicated
 * Bedrock bearer token) over a provider whose availability comes from ambient
 * credential *sources* (a stray `~/.aws` profile, an EC2 instance role). The
 * fork scopes `ModelRegistry.getAvailable()` to the `storoslop` provider only,
 * so neither `amazon-bedrock` nor `anthropic` models are ever surfaced and
 * the pick-default behavior cannot be exercised. See the fork comment on
 * `getAvailable()`.
 */
export {};
