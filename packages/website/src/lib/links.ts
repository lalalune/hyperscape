/**
 * External links configuration
 * Uses environment variables with fallbacks
 */

export const links = {
  docs: process.env.NEXT_PUBLIC_DOCS_URL || "https://hyperia-ai.mintlify.app/",
  game: process.env.NEXT_PUBLIC_GAME_URL || "https://hyperia.gg",
  discord:
    process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/f4ZwhAbKye",
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL || "https://x.com/playhyperia",
  github:
    process.env.NEXT_PUBLIC_GITHUB_URL ||
    "https://github.com/PlayHyperia/hyperia",
};

export const navigation = {
  header: [
    { label: "Docs", href: links.docs, external: true },
    { label: "Discord", href: links.discord, external: true, icon: "discord" },
    { label: "Twitter", href: links.twitter, external: true, icon: "twitter" },
  ],
  footer: {
    game: [
      { label: "Play Now", href: links.game, external: true },
      { label: "Documentation", href: links.docs, external: true },
      { label: "Roadmap", href: `${links.docs}changelog/`, external: true },
    ],
    community: [
      { label: "Discord", href: links.discord, external: true },
      { label: "Twitter/X", href: links.twitter, external: true },
      { label: "GitHub", href: links.github, external: true },
    ],
    resources: [
      { label: "Documentation", href: links.docs, external: true },
      {
        label: "API Reference",
        href: `${links.docs}api-reference/`,
        external: true,
      },
      { label: "GitHub", href: links.github, external: true },
    ],
  },
};
