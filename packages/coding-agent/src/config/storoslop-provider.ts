/**
 * Bundled storoslop provider definition.
 *
 * The storoslop fork is single-provider: this tool only talks to the bundled
 * "storoslop" provider. The provider identity (baseUrl, api) lives here; the
 * model roster itself is bundled catalog data (`packages/catalog/src/models.json`
 * under `storoslop`, curated via `STOROSLOP_STATIC_MODELS` in
 * `provider-models/openai-compat.ts`) so model updates ship with the build and
 * never require a user-config change — the same way upstream built-ins work.
 *
 * The user's `models.yml` needs only the credential:
 *
 *   providers:
 *     storoslop:
 *       apiKey: sk-…
 *
 * (`baseUrl`/`api` are optional overrides for mirror deployments.)
 */

export const STOROSLOP_PROVIDER = "storoslop";
export const STOROSLOP_BASE_URL = "http://slop.storo.cloud:4000/v1";
