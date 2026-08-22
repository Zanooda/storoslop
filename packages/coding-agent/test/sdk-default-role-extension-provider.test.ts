/**
 * PRUNED — fork-restricted feature.
 *
 * This regression test (issue #3569) verified that a `modelRoles.default`
 * pointing at an extension-registered provider's model is honored on fresh
 * interactive launches. Extension-registered model providers are fork-restricted:
 * `ModelRegistry.getAvailable()` scopes all available models to the `storoslop`
 * provider only, so extension-registered providers do not surface into the resolvable
 * model/provider lists and cannot win the default role. See the fork comment on
 * `getAvailable()`.
 */
