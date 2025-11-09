import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "intro",
    {
      type: "category",
      label: "API Documentation",
      items: [
        "api/index",
        "api/@hyperscape/shared",
        "api/@hyperscape/client",
        "api/@hyperscape/server",
      ],
    },
  ],
};

export default sidebars;
