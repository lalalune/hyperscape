/**
 * Team 2: Manual Code Review & Logic Flaw Detection
 * Deep semantic analysis focusing on business logic, authentication, and data flow
 */

import { promises as fs } from 'fs';
import path from 'path';
import { BugReport, BugCategory, BugSeverity, TeamStrategy } from './types';
import { CVSSCalculator } from './cvss-calculator';

interface CodeModule {
  path: string;
  content: string;
  imports: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
}

interface FunctionInfo {
  name: string;
  params: string[];
  isAsync: boolean;
  hasErrorHandling: boolean;
  lineStart: number;
  lineEnd: number;
  body: string;
}

interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  lineStart: number;
  lineEnd: number;
}

interface DataFlow {
  source: string;
  sink: string;
  validators: string[];
  sanitizers: string[];
  path: string[];
}

interface AuthCheck {
  endpoint: string;
  hasAuth: boolean;
  authMethod?: string;
  requiredRoles?: string[];
  lineNumber: number;
}

export class ManualCodeReviewTeam {
  teamId = 'TEAM_MANUAL';
  name = 'Logic Flaw Detection Squad';
  private strategy: TeamStrategy;
  private discoveredBugs: BugReport[] = [];
  private codeModules: Map<string, CodeModule> = new Map();

  constructor(initialStrategy: TeamStrategy) {
    this.strategy = initialStrategy;
  }

  /**
   * Perform deep semantic analysis on target files
   */
  async analyzeFiles(targetFiles: string[]): Promise<BugReport[]> {
    const startTime = Date.now();
    const reports: BugReport[] = [];

    console.log(`[${this.teamId}] Starting deep code analysis on ${targetFiles.length} files...`);

    // Phase 1: Parse all modules
    for (const file of targetFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const module = await this.parseModule(file, content);
        this.codeModules.set(file, module);
      } catch (error) {
        console.error(`[${this.teamId}] Error parsing ${file}:`, error);
      }
    }

    // Phase 2: Authentication flow analysis
    console.log(`[${this.teamId}] Analyzing authentication flows...`);
    const authReports = await this.analyzeAuthenticationFlow();
    reports.push(...authReports);

    // Phase 3: Business logic analysis
    console.log(`[${this.teamId}] Analyzing business logic...`);
    const logicReports = await this.checkBusinessLogic();
    reports.push(...logicReports);

    // Phase 4: Data flow analysis
    console.log(`[${this.teamId}] Analyzing data flows...`);
    const dataFlowReports = await this.analyzeDataFlow();
    reports.push(...dataFlowReports);

    // Phase 5: State management analysis
    console.log(`[${this.teamId}] Analyzing state management...`);
    const stateReports = await this.validateStateManagement();
    reports.push(...stateReports);

    // Phase 6: API endpoint review
    console.log(`[${this.teamId}] Reviewing API endpoints...`);
    const apiReports = await this.reviewAPIEndpoints();
    reports.push(...apiReports);

    // Phase 7: Database query analysis
    console.log(`[${this.teamId}] Analyzing database queries...`);
    const dbReports = await this.analyzeQuerySafety();
    reports.push(...dbReports);

    const endTime = Date.now();
    console.log(`[${this.teamId}] Analysis complete: ${reports.length} issues found in ${endTime - startTime}ms`);

    this.discoveredBugs.push(...reports);
    return reports;
  }

  /**
   * Parse a TypeScript module and extract structure
   */
  private async parseModule(filePath: string, content: string): Promise<CodeModule> {
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    const functions = this.extractFunctions(content);
    const classes = this.extractClasses(content);

    return {
      path: filePath,
      content,
      imports,
      exports,
      functions,
      classes
    };
  }

  /**
   * Analyze authentication and authorization flows
   */
  private async analyzeAuthenticationFlow(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    // Check for missing authentication on API endpoints
    for (const [filePath, module] of this.codeModules.entries()) {
      if (filePath.includes('index.ts') && filePath.includes('server')) {
        const authChecks = this.findAPIEndpoints(module);

        for (const check of authChecks) {
          if (!check.hasAuth) {
            reports.push(this.createBugReport(
              filePath,
              `Missing Authentication on ${check.endpoint}`,
              BugCategory.AUTH_BYPASS,
              BugSeverity.CRITICAL,
              check.lineNumber,
              this.getCodeSnippet(module.content, check.lineNumber),
              `API endpoint "${check.endpoint}" lacks authentication middleware. Any user can access this endpoint without proper authorization.`,
              `An attacker can directly access this endpoint without authentication by crafting HTTP requests. This could lead to unauthorized data access, modification, or deletion.`,
              `1. Add authentication middleware before the route handler\n2. Verify JWT token or Privy session\n3. Validate user permissions for the requested action`
            ));
          }
        }
      }
    }

    // Check for authorization bypass in character access
    for (const [filePath, module] of this.codeModules.entries()) {
      if (filePath.includes('ServerNetwork.ts') || filePath.includes('DatabaseSystem.ts')) {
        const bypassIssues = this.findAuthorizationBypasses(module);
        reports.push(...bypassIssues);
      }
    }

    // Check for JWT vulnerabilities
    for (const [filePath, module] of this.codeModules.entries()) {
      if (module.content.includes('jwt') || module.content.includes('JWT')) {
        const jwtIssues = this.analyzeJWTUsage(filePath, module);
        reports.push(...jwtIssues);
      }
    }

    return reports;
  }

  /**
   * Check business logic for flaws
   */
  private async checkBusinessLogic(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    // Check for race conditions in inventory/transaction operations
    for (const [filePath, module] of this.codeModules.entries()) {
      if (filePath.includes('inventory') || filePath.includes('equipment') || filePath.includes('Database')) {
        const raceConditions = this.detectRaceConditions(filePath, module);
        reports.push(...raceConditions);
      }
    }

    // Check for integer overflow in XP/currency systems
    for (const [filePath, module] of this.codeModules.entries()) {
      if (module.content.includes('Xp') || module.content.includes('coins') || module.content.includes('quantity')) {
        const overflowIssues = this.detectIntegerOverflow(filePath, module);
        reports.push(...overflowIssues);
      }
    }

    // Check for duplication glitches
    for (const [filePath, module] of this.codeModules.entries()) {
      if (module.content.includes('inventory') || module.content.includes('equipment')) {
        const dupeBugs = this.detectDuplicationGlitches(filePath, module);
        reports.push(...dupeBugs);
      }
    }

    // Check for logic flaws in skill/level calculations
    for (const [filePath, module] of this.codeModules.entries()) {
      if (module.content.includes('Level') || module.content.includes('skill') || module.content.includes('combat')) {
        const calcIssues = this.detectCalculationFlaws(filePath, module);
        reports.push(...calcIssues);
      }
    }

    return reports;
  }

  /**
   * Analyze data flow for validation gaps
   */
  private async analyzeDataFlow(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    for (const [filePath, module] of this.codeModules.entries()) {
      // Trace user input through the system
      const dataFlows = this.traceUserInputs(module);

      for (const flow of dataFlows) {
        // Check if input reaches a sink without validation
        if (flow.validators.length === 0 && this.isSensitiveSink(flow.sink)) {
          const lineNumber = this.findLineNumber(module.content, flow.sink);
          reports.push(this.createBugReport(
            filePath,
            `Unvalidated Input Reaches Sensitive Sink`,
            BugCategory.BROKEN_ACCESS,
            BugSeverity.HIGH,
            lineNumber,
            this.getCodeSnippet(module.content, lineNumber),
            `User input from ${flow.source} flows to ${flow.sink} without validation. This could allow attackers to inject malicious data.`,
            `Attacker crafts malicious input that bypasses intended business logic because the application doesn't validate the data before using it in sensitive operations.`,
            `1. Add input validation at the entry point (${flow.source})\n2. Use TypeScript type guards to ensure data integrity\n3. Implement schema validation (Zod, Yup) for complex objects\n4. Sanitize data before use in ${flow.sink}`
          ));
        }
      }

      // Check for missing sanitization in database queries
      if (module.content.includes('db.') || module.content.includes('drizzle')) {
        const sqlIssues = this.detectUnsafeDatabaseQueries(filePath, module);
        reports.push(...sqlIssues);
      }
    }

    return reports;
  }

  /**
   * Validate state management for consistency issues
   */
  private async validateStateManagement(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    for (const [filePath, module] of this.codeModules.entries()) {
      // Check for state mutations without synchronization
      if (module.content.includes('world.entities') || module.content.includes('socket.player')) {
        const stateIssues = this.detectStateMutationIssues(filePath, module);
        reports.push(...stateIssues);
      }

      // Check for missing state validation after async operations
      const asyncIssues = this.detectAsyncStateIssues(filePath, module);
      reports.push(...asyncIssues);
    }

    return reports;
  }

  /**
   * Review API endpoints for security issues
   */
  private async reviewAPIEndpoints(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    for (const [filePath, module] of this.codeModules.entries()) {
      if (!filePath.includes('server') && !filePath.includes('api')) continue;

      // Find all route definitions
      const routes = this.extractAPIRoutes(module);

      for (const route of routes) {
        // Check for IDOR (Insecure Direct Object Reference)
        if (this.hasIDORVulnerability(route)) {
          reports.push(this.createBugReport(
            filePath,
            `IDOR Vulnerability in ${route.method} ${route.path}`,
            BugCategory.BROKEN_ACCESS,
            BugSeverity.HIGH,
            route.lineNumber,
            route.code,
            `Endpoint allows users to access resources by ID without verifying ownership. Users can access other players' data by manipulating IDs.`,
            `1. Attacker identifies the API endpoint and parameter structure\n2. Changes playerId/characterId parameter to another user's ID\n3. Accesses or modifies other users' data without authorization`,
            `1. Always verify resource ownership before allowing access\n2. Check that socket.player.id matches the requested playerId\n3. Use database queries that filter by both resource ID and user ID\n4. Implement proper authorization checks using hasRole() or custom permissions`
          ));
        }

        // Check for rate limiting
        if (!this.hasRateLimit(route)) {
          reports.push(this.createBugReport(
            filePath,
            `Missing Rate Limiting on ${route.method} ${route.path}`,
            BugCategory.DOS,
            BugSeverity.MEDIUM,
            route.lineNumber,
            route.code,
            `API endpoint lacks rate limiting, allowing abuse through excessive requests.`,
            `Attacker floods the endpoint with requests, consuming server resources and potentially causing denial of service for legitimate users.`,
            `1. Implement rate limiting middleware (e.g., fastify-rate-limit)\n2. Set appropriate limits based on endpoint sensitivity\n3. Use IP-based or user-based rate limiting\n4. Return 429 Too Many Requests when limit exceeded`
          ));
        }
      }
    }

    return reports;
  }

  /**
   * Analyze database queries for injection and safety issues
   */
  private async analyzeQuerySafety(): Promise<BugReport[]> {
    const reports: BugReport[] = [];

    for (const [filePath, module] of this.codeModules.entries()) {
      // Check for unsafe query construction
      const lines = module.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Check for template string injection in queries
        if ((line.includes('db.query') || line.includes('.execute')) && line.includes('${')) {
          reports.push(this.createBugReport(
            filePath,
            'Potential SQL Injection via Template String',
            BugCategory.INJECTION,
            BugSeverity.CRITICAL,
            lineNumber,
            this.getCodeSnippet(module.content, lineNumber),
            'Database query uses template string interpolation which may be vulnerable to SQL injection if user input is included.',
            'Attacker injects malicious SQL through user-controlled variables, potentially reading, modifying, or deleting database data.',
            '1. Use parameterized queries with Drizzle ORM\n2. Never interpolate user input directly into SQL\n3. Use prepared statements with bound parameters\n4. Validate and sanitize all inputs before database operations'
          ));
        }

        // Check for missing transaction boundaries on multi-step operations
        if (line.includes('await db.') && this.isMultiStepOperation(lines, i)) {
          const hasTransaction = this.checkForTransaction(lines, i);
          if (!hasTransaction) {
            reports.push(this.createBugReport(
              filePath,
              'Missing Transaction for Multi-Step Database Operation',
              BugCategory.RACE_CONDITION,
              BugSeverity.HIGH,
              lineNumber,
              this.getCodeSnippet(module.content, lineNumber, 10),
              'Multiple database operations are performed without a transaction boundary, creating a race condition window where data can become inconsistent.',
              '1. Two concurrent requests modify the same data\n2. First request reads stale data between operations\n3. Second request completes first, modifying state\n4. First request completes with stale data, overwriting changes',
              '1. Wrap related operations in db.transaction()\n2. Use database-level locking for critical sections\n3. Implement optimistic locking with version numbers\n4. Use SELECT FOR UPDATE for atomic read-modify-write'
            ));
          }
        }
      }
    }

    return reports;
  }

  // ============================================================================
  // HELPER METHODS - Code Analysis
  // ============================================================================

  private extractImports(content: string): string[] {
    const importRegex = /import\s+(?:{[^}]+}|[\w]+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractExports(content: string): string[] {
    const exportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+([\w]+)/g;
    const exports: string[] = [];
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
  }

  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    // Match: function name(...) or const name = (...) => or async function
    const funcRegex = /(?:async\s+)?(?:function\s+([\w]+)|(?:const|let)\s+([\w]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(funcRegex);

      if (match) {
        const name = match[1] || match[2];
        const isAsync = line.includes('async');
        const params = this.extractParams(line);
        const lineStart = i + 1;
        const lineEnd = this.findFunctionEnd(lines, i);
        const body = lines.slice(i, lineEnd).join('\n');
        const hasErrorHandling = body.includes('try') && body.includes('catch');

        functions.push({
          name,
          params,
          isAsync,
          hasErrorHandling,
          lineStart,
          lineEnd,
          body
        });
      }
    }

    return functions;
  }

  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/class\s+([\w]+)/);

      if (match) {
        const name = match[1];
        const lineStart = i + 1;
        const lineEnd = this.findClassEnd(lines, i);
        const classBody = lines.slice(i, lineEnd).join('\n');
        const methods = this.extractMethods(classBody, lineStart);

        classes.push({
          name,
          methods,
          lineStart,
          lineEnd
        });
      }
    }

    return classes;
  }

  private extractMethods(classBody: string, classLineStart: number): FunctionInfo[] {
    const methods: FunctionInfo[] = [];
    const lines = classBody.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/(?:async\s+)?([\w]+)\s*\([^)]*\)\s*[:{]/);

      if (match && !line.includes('constructor')) {
        const name = match[1];
        const isAsync = line.includes('async');
        const params = this.extractParams(line);
        const lineStart = classLineStart + i;
        const lineEnd = this.findFunctionEnd(lines, i);
        const body = lines.slice(i, lineEnd).join('\n');
        const hasErrorHandling = body.includes('try') && body.includes('catch');

        methods.push({
          name,
          params,
          isAsync,
          hasErrorHandling,
          lineStart,
          lineEnd,
          body
        });
      }
    }

    return methods;
  }

  private extractParams(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map(p => p.trim().split(/[:\s]/)[0])
      .filter(p => p.length > 0);
  }

  private findFunctionEnd(lines: string[], start: number): number {
    let braceCount = 0;
    let foundStart = false;

    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    return lines.length;
  }

  private findClassEnd(lines: string[], start: number): number {
    return this.findFunctionEnd(lines, start);
  }

  private findAPIEndpoints(module: CodeModule): AuthCheck[] {
    const checks: AuthCheck[] = [];
    const lines = module.content.split('\n');

    const routeRegex = /fastify\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(routeRegex);

      if (match) {
        const method = match[1];
        const endpoint = match[2];

        // Look ahead to find authentication
        const hasAuth = this.checkEndpointAuth(lines, i, i + 20);

        checks.push({
          endpoint: `${method.toUpperCase()} ${endpoint}`,
          hasAuth,
          lineNumber: i + 1
        });
      }
    }

    return checks;
  }

  private checkEndpointAuth(lines: string[], start: number, end: number): boolean {
    for (let i = start; i < Math.min(end, lines.length); i++) {
      const line = lines[i];
      if (
        line.includes('verifyJWT') ||
        line.includes('verifyPrivyToken') ||
        line.includes('requireAuth') ||
        line.includes('isAuthenticated') ||
        line.includes('authToken') ||
        line.includes('socket.player') // Assumes player is authenticated
      ) {
        return true;
      }
    }
    return false;
  }

  private findAuthorizationBypasses(module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for direct player access without ownership verification
      if (line.includes('playerId') && line.includes('db.') && !line.includes('accountId')) {
        const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 5)).join('\n');

        // If we don't see ownership check in context, flag it
        if (!context.includes('socket.player') && !context.includes('accountId') && !context.includes('userId')) {
          reports.push(this.createBugReport(
            module.path,
            'Missing Ownership Verification for Player Data Access',
            BugCategory.AUTHZ_FAILURE,
            BugSeverity.HIGH,
            i + 1,
            this.getCodeSnippet(module.content, i + 1),
            'Code accesses player data by ID without verifying the requesting user owns that player character.',
            'Attacker can access or modify other players\' characters by changing the playerId parameter in requests.',
            '1. Verify socket.player.accountId matches the character\'s accountId\n2. Add authorization check before database query\n3. Use JOIN with users table to enforce ownership\n4. Return 403 Forbidden if ownership check fails'
          ));
        }
      }
    }

    return reports;
  }

  private analyzeJWTUsage(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for weak JWT secrets
      if (line.includes('sign') && line.includes('secret')) {
        if (line.includes('"') || line.includes("'")) {
          reports.push(this.createBugReport(
            filePath,
            'Hardcoded JWT Secret',
            BugCategory.CRYPTO_FAILURE,
            BugSeverity.CRITICAL,
            i + 1,
            this.getCodeSnippet(module.content, i + 1),
            'JWT secret is hardcoded in source code instead of using environment variables.',
            'Attacker who gains access to source code can forge valid JWT tokens and impersonate any user.',
            '1. Store JWT secret in environment variable (JWT_SECRET)\n2. Use crypto.randomBytes(64).toString(\'hex\') to generate strong secrets\n3. Never commit secrets to version control\n4. Rotate secrets periodically'
          ));
        }
      }

      // Check for missing JWT expiration
      if (line.includes('jwt.sign') && !line.includes('expiresIn')) {
        reports.push(this.createBugReport(
          filePath,
          'JWT Token Without Expiration',
          BugCategory.CRYPTO_FAILURE,
          BugSeverity.MEDIUM,
          i + 1,
          this.getCodeSnippet(module.content, i + 1),
          'JWT token is created without expiration time, allowing tokens to remain valid indefinitely.',
          'Stolen or leaked tokens can be used by attackers indefinitely, even after the user logs out or changes their password.',
          '1. Add expiresIn option to jwt.sign (e.g., \'24h\', \'7d\')\n2. Implement token refresh mechanism for long-lived sessions\n3. Maintain token blacklist for immediate revocation\n4. Implement session management with server-side state'
        ));
      }
    }

    return reports;
  }

  private detectRaceConditions(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for read-modify-write without transaction
      if (line.includes('await db.') && line.includes('.select')) {
        // Look ahead for update
        const nextLines = lines.slice(i + 1, Math.min(i + 10, lines.length));
        const hasUpdate = nextLines.some(l => l.includes('.update') || l.includes('.set'));
        const hasTransaction = lines.slice(Math.max(0, i - 5), i).some(l => l.includes('transaction'));

        if (hasUpdate && !hasTransaction) {
          reports.push(this.createBugReport(
            filePath,
            'Race Condition in Read-Modify-Write Operation',
            BugCategory.RACE_CONDITION,
            BugSeverity.HIGH,
            i + 1,
            this.getCodeSnippet(module.content, i + 1, 10),
            'Database operation performs read-modify-write pattern without transaction or locking, allowing concurrent modifications to create inconsistent state.',
            '1. Player 1 reads item quantity: 5\n2. Player 2 reads item quantity: 5\n3. Player 1 decrements to 4 and writes\n4. Player 2 decrements to 4 and writes\n5. Final quantity is 4 instead of 3 (item duplication)',
            '1. Wrap read-modify-write in db.transaction()\n2. Use SELECT FOR UPDATE to lock rows\n3. Implement optimistic locking with version field\n4. Use atomic UPDATE ... SET quantity = quantity - 1'
          ));
        }
      }
    }

    return reports;
  }

  private detectIntegerOverflow(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for arithmetic without overflow protection
      if ((line.includes('Xp +=') || line.includes('coins +=') || line.includes('quantity +=')) &&
          !line.includes('Math.min')) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 3)).join('\n');

        if (!context.includes('MAX_') && !context.includes('Number.MAX_SAFE_INTEGER')) {
          reports.push(this.createBugReport(
            filePath,
            'Potential Integer Overflow in Game Currency/Stats',
            BugCategory.LOGIC_FLAW,
            BugSeverity.MEDIUM,
            i + 1,
            this.getCodeSnippet(module.content, i + 1),
            'Arithmetic operation on game currency or stats lacks overflow protection, potentially allowing values to exceed intended limits.',
            'Attacker exploits game mechanics to accumulate extreme values (e.g., XP, coins) beyond JavaScript safe integer range (2^53-1), causing gameplay imbalance or data corruption.',
            '1. Define maximum constants (MAX_XP, MAX_COINS)\n2. Use Math.min(current + amount, MAX_VALUE) for additions\n3. Validate input amounts before operations\n4. Use BigInt for values that may exceed safe integer range\n5. Implement server-side validation of all stat changes'
          ));
        }
      }
    }

    return reports;
  }

  private detectDuplicationGlitches(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for item transfer without proper state validation
      if ((line.includes('inventory') || line.includes('equipment')) &&
          (line.includes('.add') || line.includes('.push'))) {

        const context = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 10)).join('\n');

        // Look for remove operation
        const hasRemove = context.includes('.remove') || context.includes('.delete') || context.includes('.splice');
        const hasTransaction = context.includes('transaction');

        if (hasRemove && !hasTransaction) {
          reports.push(this.createBugReport(
            filePath,
            'Potential Item Duplication via Race Condition',
            BugCategory.LOGIC_FLAW,
            BugSeverity.CRITICAL,
            i + 1,
            this.getCodeSnippet(module.content, i + 1, 15),
            'Item transfer operation (add/remove) is not atomic, creating window for duplication if player cancels or disconnects mid-operation.',
            '1. Player initiates item transfer (e.g., inventory to bank)\n2. Server adds item to destination (bank)\n3. Player disconnects before server removes from source\n4. Server state rollback keeps item in inventory\n5. Player reconnects with item in both inventory AND bank',
            '1. Use database transactions for all item transfers\n2. Add source and remove from destination in single atomic operation\n3. Implement two-phase commit or compensating transactions\n4. Validate item existence in source before transfer\n5. Use unique item instance IDs with transfer tracking'
          ));
        }
      }
    }

    return reports;
  }

  private detectCalculationFlaws(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for level/damage calculations
      if ((line.includes('damage') || line.includes('Level') || line.includes('combat')) &&
          (line.includes('*') || line.includes('/') || line.includes('Math.'))) {

        // Check for missing input validation
        const context = lines.slice(Math.max(0, i - 5), i).join('\n');
        const hasValidation = context.includes('if') || context.includes('Math.max') || context.includes('Math.min');

        if (!hasValidation) {
          reports.push(this.createBugReport(
            filePath,
            'Missing Input Validation in Game Calculation',
            BugCategory.LOGIC_FLAW,
            BugSeverity.MEDIUM,
            i + 1,
            this.getCodeSnippet(module.content, i + 1),
            'Game calculation uses player stats or items without validating inputs, potentially allowing negative values, NaN, or Infinity to break game mechanics.',
            'Attacker exploits edge cases (divide by zero, negative stats, extreme values) to cause: 1) Invincibility, 2) Instant kills, 3) Infinite resources, 4) Server crashes',
            '1. Validate all inputs before calculations (level > 0, damage >= 0)\n2. Use Math.max(0, result) to prevent negative values\n3. Check for NaN and Infinity: Number.isFinite(result)\n4. Clamp results to reasonable ranges\n5. Add server-side sanity checks on calculated values'
          ));
        }
      }
    }

    return reports;
  }

  private traceUserInputs(module: CodeModule): DataFlow[] {
    const flows: DataFlow[] = [];
    const lines = module.content.split('\n');

    // Common user input sources
    const sources = [
      'req.body',
      'req.query',
      'req.params',
      'request.body',
      'request.query',
      'request.params',
      'socket.data',
      'message.',
      'params.'
    ];

    // Sensitive sinks
    const sinks = [
      'db.',
      'execute(',
      'eval(',
      'exec(',
      'spawn(',
      'writeFile',
      'innerHTML'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find sources
      for (const source of sources) {
        if (line.includes(source)) {
          const varName = this.extractVariableName(line);

          // Trace forward to find sinks
          for (let j = i; j < Math.min(i + 50, lines.length); j++) {
            const nextLine = lines[j];

            for (const sink of sinks) {
              if (nextLine.includes(sink) && (nextLine.includes(varName) || varName === '')) {
                const validators = this.findValidators(lines, i, j);

                flows.push({
                  source: source,
                  sink: sink,
                  validators,
                  sanitizers: [],
                  path: lines.slice(i, j + 1)
                });
              }
            }
          }
        }
      }
    }

    return flows;
  }

  private extractVariableName(line: string): string {
    const match = line.match(/(?:const|let|var)\s+([\w]+)/);
    return match ? match[1] : '';
  }

  private findValidators(lines: string[], start: number, end: number): string[] {
    const validators: string[] = [];

    for (let i = start; i < end; i++) {
      const line = lines[i];

      if (line.includes('validate') || line.includes('check') || line.includes('sanitize') ||
          line.includes('typeof') || line.includes('instanceof') || line.includes('parseInt') ||
          line.includes('parseFloat') || line.includes('.test(')) {
        validators.push(line.trim());
      }
    }

    return validators;
  }

  private isSensitiveSink(sink: string): boolean {
    const sensitiveSinks = ['db.', 'execute', 'eval', 'exec', 'spawn', 'writeFile', 'innerHTML'];
    return sensitiveSinks.some(s => sink.includes(s));
  }

  private detectUnsafeDatabaseQueries(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for dynamic table/column names from user input
      if (line.includes('db.') && line.includes('[') && line.includes(']')) {
        const context = lines.slice(Math.max(0, i - 5), i).join('\n');

        // If the bracket contains a variable that might come from user input
        if (!context.includes('const') || context.includes('req.') || context.includes('params.')) {
          reports.push(this.createBugReport(
            filePath,
            'Dynamic Database Query Construction',
            BugCategory.INJECTION,
            BugSeverity.HIGH,
            i + 1,
            this.getCodeSnippet(module.content, i + 1),
            'Database query uses dynamic table or column names, potentially allowing SQL injection through schema manipulation.',
            'Attacker controls table/column name selection through parameters, potentially: 1) Accessing unauthorized tables, 2) Extracting sensitive data, 3) Modifying query structure',
            '1. Use whitelist of allowed table/column names\n2. Validate input against predefined schema\n3. Never allow user input to directly specify table/column names\n4. Use Drizzle schema definitions with static references'
          ));
        }
      }
    }

    return reports;
  }

  private detectStateMutationIssues(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];
    const lines = module.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for direct state mutation without events
      if ((line.includes('world.entities') || line.includes('socket.player')) &&
          (line.includes('.data.') || line.includes('.state.'))) {

        const context = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');

        // Look for event emission or broadcast
        const hasEvent = context.includes('emit') || context.includes('broadcast') || context.includes('writePacket');

        if (!hasEvent) {
          reports.push(this.createBugReport(
            filePath,
            'State Mutation Without Client Notification',
            BugCategory.LOGIC_FLAW,
            BugSeverity.MEDIUM,
            i + 1,
            this.getCodeSnippet(module.content, i + 1, 10),
            'Server mutates entity state but doesn\'t notify connected clients, causing client-server desync.',
            'Game state diverges between server and clients, causing: 1) Visual glitches, 2) Failed interactions, 3) Duplication bugs when state is re-synchronized, 4) Combat calculation errors',
            '1. Emit entityModified event after state changes\n2. Use writePacket() to broadcast updates to all clients\n3. Implement state mutation helpers that automatically notify\n4. Use ECS system update cycle instead of direct mutations'
          ));
        }
      }
    }

    return reports;
  }

  private detectAsyncStateIssues(filePath: string, module: CodeModule): BugReport[] {
    const reports: BugReport[] = [];

    for (const func of module.functions) {
      if (!func.isAsync) continue;

      const lines = func.body.split('\n');
      let hasStateAccess = false;
      let hasAwait = false;
      let stateAccessLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('await')) {
          hasAwait = true;
        }

        if (line.includes('player.') || line.includes('entity.') || line.includes('world.')) {
          if (hasAwait) {
            // State accessed after await - potential stale data
            hasStateAccess = true;
            stateAccessLine = func.lineStart + i;
          }
        }
      }

      if (hasStateAccess && hasAwait) {
        reports.push(this.createBugReport(
          filePath,
          'Stale State Access After Async Operation',
          BugCategory.RACE_CONDITION,
          BugSeverity.MEDIUM,
          stateAccessLine,
          func.body,
          'Function accesses entity/player state after async operation without revalidating, potentially using stale data if state changed during the await.',
          '1. Player initiates action (attack)\n2. Server reads player.attackLevel\n3. Async database query executes (50ms)\n4. During query, player levels up attack\n5. Query completes, uses stale attackLevel\n6. Wrong damage calculated',
          '1. Re-read entity state after async operations\n2. Use optimistic locking with version checks\n3. Pass state as immutable parameters\n4. Validate state is still valid before continuing\n5. Use transactions to prevent concurrent modifications'
        ));
      }
    }

    return reports;
  }

  private extractAPIRoutes(module: CodeModule): Array<{method: string, path: string, code: string, lineNumber: number}> {
    const routes: Array<{method: string, path: string, code: string, lineNumber: number}> = [];
    const lines = module.content.split('\n');

    const routeRegex = /(fastify|app|router)\.(get|post|put|delete|patch)\s*(?:<[^>]+>)?\s*\(\s*['"]([^'"]+)['"]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(routeRegex);

      if (match) {
        const method = match[2].toUpperCase();
        const path = match[3];
        const code = this.getCodeSnippet(module.content, i + 1, 10);

        routes.push({
          method,
          path,
          code,
          lineNumber: i + 1
        });
      }
    }

    return routes;
  }

  private hasIDORVulnerability(route: {method: string, path: string, code: string}): boolean {
    // Check if route accepts ID parameter
    const hasIdParam = route.path.includes(':') || route.code.includes('playerId') ||
                       route.code.includes('characterId') || route.code.includes('userId');

    if (!hasIdParam) return false;

    // Check if there's ownership verification
    const hasOwnershipCheck = route.code.includes('accountId') ||
                             route.code.includes('socket.player') ||
                             route.code.includes('verifyOwnership') ||
                             route.code.includes('checkPermission');

    return !hasOwnershipCheck;
  }

  private hasRateLimit(route: {method: string, path: string, code: string}): boolean {
    return route.code.includes('rateLimit') ||
           route.code.includes('rateLimiter') ||
           route.code.includes('limit:');
  }

  private isMultiStepOperation(lines: string[], startIndex: number): boolean {
    const nextLines = lines.slice(startIndex, Math.min(startIndex + 15, lines.length));
    const dbOps = nextLines.filter(l => l.includes('await db.')).length;
    return dbOps >= 2;
  }

  private checkForTransaction(lines: string[], currentIndex: number): boolean {
    const searchLines = lines.slice(Math.max(0, currentIndex - 10), currentIndex + 1);
    return searchLines.some(l => l.includes('transaction') || l.includes('.tx'));
  }

  private findLineNumber(content: string, searchText: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 1;
  }

  private getCodeSnippet(content: string, lineNumber: number, contextLines: number = 5): string {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    return lines.slice(start, end).join('\n');
  }

  private createBugReport(
    file: string,
    title: string,
    category: BugCategory,
    severity: BugSeverity,
    lineNumber: number,
    snippet: string,
    description: string,
    exploitScenario: string,
    remediation: string
  ): BugReport {
    const cvssScore = this.estimateCVSS(severity, category);
    const bountyValue = CVSSCalculator.calculateBountyValue(cvssScore.baseScore, severity, true);

    return {
      id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      teamId: this.teamId,
      title,
      description,
      category,
      severity,
      cvssScore,
      location: {
        file,
        lines: [lineNumber],
        snippet
      },
      exploitScenario,
      remediation,
      references: this.getReferences(category),
      discoveryMethod: 'Manual Code Review & Logic Analysis',
      timeToDiscover: 0,
      isValid: true,
      isFalsePositive: false,
      isUnique: true,
      bountyValue
    };
  }

  private estimateCVSS(severity: BugSeverity, category: BugCategory): any {
    const criticalMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'NONE' as const,
      userInteraction: 'NONE' as const,
      scope: 'CHANGED' as const,
      confidentialityImpact: 'HIGH' as const,
      integrityImpact: 'HIGH' as const,
      availabilityImpact: 'HIGH' as const
    };

    const highMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'LOW' as const,
      userInteraction: 'NONE' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'HIGH' as const,
      integrityImpact: 'HIGH' as const,
      availabilityImpact: 'NONE' as const
    };

    const mediumMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'LOW' as const,
      userInteraction: 'REQUIRED' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'LOW' as const,
      integrityImpact: 'LOW' as const,
      availabilityImpact: 'NONE' as const
    };

    const lowMetrics = {
      attackVector: 'LOCAL' as const,
      attackComplexity: 'HIGH' as const,
      privilegesRequired: 'HIGH' as const,
      userInteraction: 'REQUIRED' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'LOW' as const,
      integrityImpact: 'NONE' as const,
      availabilityImpact: 'NONE' as const
    };

    let metrics;
    switch (severity) {
      case BugSeverity.CRITICAL:
        metrics = criticalMetrics;
        break;
      case BugSeverity.HIGH:
        metrics = highMetrics;
        break;
      case BugSeverity.MEDIUM:
        metrics = mediumMetrics;
        break;
      default:
        metrics = lowMetrics;
    }

    return CVSSCalculator.calculateBaseScore(metrics);
  }

  private getReferences(category: BugCategory): string[] {
    const refs: Record<string, string[]> = {
      [BugCategory.AUTH_BYPASS]: [
        'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
        'https://cwe.mitre.org/data/definitions/287.html'
      ],
      [BugCategory.AUTHZ_FAILURE]: [
        'https://owasp.org/Top10/A01_2021-Broken_Access_Control/',
        'https://cwe.mitre.org/data/definitions/285.html'
      ],
      [BugCategory.BROKEN_ACCESS]: [
        'https://owasp.org/Top10/A01_2021-Broken_Access_Control/',
        'https://portswigger.net/web-security/access-control'
      ],
      [BugCategory.LOGIC_FLAW]: [
        'https://owasp.org/www-community/vulnerabilities/Business_logic_vulnerability',
        'https://cwe.mitre.org/data/definitions/840.html'
      ],
      [BugCategory.RACE_CONDITION]: [
        'https://cwe.mitre.org/data/definitions/362.html',
        'https://owasp.org/www-community/vulnerabilities/Race_Conditions'
      ],
      [BugCategory.INJECTION]: [
        'https://owasp.org/Top10/A03_2021-Injection/',
        'https://cwe.mitre.org/data/definitions/89.html'
      ]
    };

    return refs[category] || [
      'https://owasp.org/Top10/',
      'https://cwe.mitre.org/'
    ];
  }

  updateStrategy(newStrategy: Partial<TeamStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  getStrategy(): TeamStrategy {
    return this.strategy;
  }

  getDiscoveredBugs(): BugReport[] {
    return this.discoveredBugs;
  }
}
