export interface TestCase {
  name: string;
  fn: (runtime: any) => Promise<void> | void;
}

export interface TestSuite {
  name: string;
  description?: string;
  tests: TestCase[];
}
