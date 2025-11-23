/**
 * EMOTES_LIST - AI agent social emotes
 *
 * Currently empty - emotes are now served via CDN (assets-repo).
 * The plugin's dynamic emote upload feature is disabled until
 * a new emote delivery mechanism is implemented.
 *
 * Game emotes (idle, walk, run, combat, etc.) are served via
 * the asset:// protocol from the CDN, not bundled with the plugin.
 */
export const EMOTES_LIST: Array<{
  name: string;
  path: string;
  duration: number;
  description: string;
}> = [];
