/**
 * PRUNED — fork-restricted feature.
 *
 * This regression test (issue #6114) verified that a `modelRoles.default`
 * pointing at a discovery-only local provider model (LM Studio) wins over an
 * authenticated bundled fallback on a cache-cold boot. The fork removes local /
 * discoverable model discovery: `ModelRegistry.getDiscoverableProviders()` returns `[]`
 * and `getAvailable()` scopes every available model to the `storoslop` provider.
 * LM Studio / other discoverable providers are never surfaced, so this behavior cannot
 * exist in the fork. See the fork comment on `getDiscoverableProviders()`.
 */
