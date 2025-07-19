/**
 * Simple RPG Testing Framework
 * 
 * Tests the actual Hyperfy RPG implementation with minimal complexity.
 * No fiction, no over-engineering, just basic functional validation.
 */

export { SimpleRPGTest, runSimpleRPGTest, type SimpleTestResult } from './SimpleRPGTest'

/**
 * Quick test runner for basic validation
 */
export const RPGTest = {
  /**
   * Run basic functional test of RPG world
   */
  async runBasicTest() {
    const { runSimpleRPGTest } = await import('./SimpleRPGTest')
    return runSimpleRPGTest()
  }
}