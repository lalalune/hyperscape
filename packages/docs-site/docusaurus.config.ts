import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Hyperscape Documentation",
  tagline: "AI-powered virtual world with RPG elements",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://docs.flobots.xyz",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  organizationName: "HyperscapeAI", // Usually your GitHub org/user name.
  projectName: "hyperscape", // Usually your repo name.

  onBrokenLinks: "warn",
  onBrokenAnchors: "ignore", // Ignore broken anchors in auto-generated API docs

  // Markdown configuration
  markdown: {
    format: "mdx",
    mermaid: false,
    preprocessor: undefined,
    parseFrontMatter: undefined,
    mdx1Compat: {
      comments: true,
      admonitions: true,
      headingIds: true,
    },
    remarkRehypeOptions: undefined,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
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
          // Remove this to remove the "edit this page" links.
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
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
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
          label: "API Documentation",
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
              label: "API Documentation",
              to: "/docs/intro",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/HyperscapeAI/hyperscape",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Hyperscape Team. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
