/**
 * Fork test preload.
 *
 * The single-provider chat rule is a product policy, not a fixture concern:
 * upstream suites pin roles to bundled chat models while testing provider-agnostic
 * behaviour, so the test process starts permissive. Tests that assert the policy
 * itself call `enforceChatProviderRestrictionForTest()`.
 */
Bun.env.PI_TEST_UNRESTRICTED_CHAT = "1";
