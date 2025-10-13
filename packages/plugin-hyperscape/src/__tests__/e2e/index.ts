import type { TestSuite } from "./types";
import starterPluginTestSuite from "./starter-plugin";
import hyperscapeIntegrationTestSuite from "./hyperscape-integration";
import hyperscapeRealRuntimeTestSuite from "./real-runtime-test";
import multiAgentTestSuite from "./multi-agent-test";

export const testSuites: TestSuite[] = [
  starterPluginTestSuite,
  hyperscapeIntegrationTestSuite,
  hyperscapeRealRuntimeTestSuite,
  multiAgentTestSuite,
];

export default testSuites;
