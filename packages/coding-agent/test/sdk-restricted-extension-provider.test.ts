/**
 * PRUNED — fork-restricted feature.
 *
 * This test set `modelRoles.default` to an extension-registered provider's model
 * (`restricted-session-provider`) and asserted the session model resolves to it,
 * including across a restricted child session. Extension-registered model providers are
 * fork-restricted: `ModelRegistry.getAvailable()` scopes all available models to the
 * `storoslop` provider only, so extension-registered providers are not surfaced as
 * selectable/honored default-role models. See the fork comment on `getAvailable()`.
 */
