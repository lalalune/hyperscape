/**
 * Shared agent-server endpoint constant.
 *
 * Both the design-with-AI dialog (onboarding mode) and the
 * world-studio companion (companion mode) talk to the same
 * agent-server `/design` endpoint. Centralising the default
 * here means a future env-var-driven override only has to land
 * in one place.
 *
 * The actual streaming endpoint is `<DEFAULT_DESIGN_ENDPOINT>/stream`;
 * callers append the `/stream` suffix at the fetch site.
 */
export const DEFAULT_DESIGN_ENDPOINT = "http://localhost:5180/design";
