import type { TestSuite } from './types';
import starterPluginTestSuite from './starter-plugin';
import hyperfyIntegrationTestSuite from './hyperfy-integration';
import hyperfyRealRuntimeTestSuite from './real-runtime-test';
import multiAgentTestSuite from './multi-agent.test';

export const testSuites: TestSuite[] = [
  starterPluginTestSuite,
  hyperfyIntegrationTestSuite,
  hyperfyRealRuntimeTestSuite,
  multiAgentTestSuite,
];

export default testSuites;
