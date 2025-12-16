import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Hyperscape",
  tagline: "3D multiplayer game engine",
  favicon: "img/favicon.ico",

  url: "https://docs.hyperscape.xyz",
  baseUrl: "/",

  organizationName: "HyperscapeAI",
  projectName: "hyperscape",

  onBrokenLinks: "warn",
  onBrokenAnchors: "ignore",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/HyperscapeAI/hyperscape/tree/main/packages/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Hyperscape",
      logo: {
        alt: "Hyperscape Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "API",
        },
        {
          href: "https://github.com/HyperscapeAI/hyperscape",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "API",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "Links",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/HyperscapeAI/hyperscape",
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Hyperscape`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
