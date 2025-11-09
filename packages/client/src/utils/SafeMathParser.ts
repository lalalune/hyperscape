/**
 * Safe Math Parser
 * Replaces dangerous eval() usage with a secure mathematical expression parser
 * Supports basic arithmetic operations: +, -, *, /, (), decimal numbers
 */

interface ParseResult {
  success: boolean;
  value: number;
  error?: string;
}

/**
 * SafeMathParser - Secure mathematical expression evaluator
 *
 * Provides a safe alternative to eval() for parsing and evaluating user-provided
 * mathematical expressions. Uses the Shunting Yard algorithm for expression parsing.
 *
 * @public
 */
export class SafeMathParser {
  /** Allowed operators in mathematical expressions */
  private static readonly OPERATORS = ["+", "-", "*", "/", "(", ")"];

  /** Operator precedence for correct evaluation order */
  private static readonly PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2 };

  /**
   * Safely parses and evaluates a mathematical expression
   *
   * Validates input, tokenizes the expression, and evaluates using the
   * Shunting Yard algorithm. Rejects any suspicious patterns that might
   * indicate code injection attempts.
   *
   * @param expression - The mathematical expression to evaluate (e.g., "2 + 3 * 4")
   * @param defaultValue - Value to return if parsing fails
   * @returns ParseResult object with success flag and computed value
   *
   * @example
   * ```typescript
   * const result = SafeMathParser.parse("(2 + 3) * 4");
   * console.log(result); // => { success: true, value: 20 }
   *
   * const invalid = SafeMathParser.parse("alert('xss')", 0);
   * console.log(invalid); // => { success: false, value: 0, error: "..." }
   * ```
   *
   * @public
   */
  static parse(expression: string, defaultValue: number = 0): ParseResult {
    const sanitized = this.sanitizeInput(expression);
    if (!sanitized) {
      return {
        success: false,
        value: defaultValue,
        error: "Invalid characters in expression",
      };
    }

    const simpleNumber = parseFloat(sanitized);
    if (!isNaN(simpleNumber) && sanitized === simpleNumber.toString()) {
      return { success: true, value: simpleNumber };
    }

    const tokens = this.tokenize(sanitized);
    if (tokens.length === 0) {
      return { success: false, value: defaultValue, error: "Empty expression" };
    }

    const result = this.evaluateTokens(tokens);

    if (isNaN(result) || !isFinite(result)) {
      return {
        success: false,
        value: defaultValue,
        error: "Result is not a valid number",
      };
    }

    return { success: true, value: result };
  }

  /**
   * Sanitizes input to only allow safe mathematical characters
   *
   * Removes whitespace and validates that the input contains only numbers,
   * operators, and parentheses. Rejects any input with function calls,
   * variable names, or other suspicious patterns.
   *
   * @param input - The user-provided expression string
   * @returns Sanitized expression or null if invalid
   *
   * @internal
   */
  private static sanitizeInput(input: string): string | null {
    // Remove all whitespace
    const cleaned = input.replace(/\s/g, "");

    // Check if input contains only allowed characters
    const allowedChars = /^[0-9+\-*/.()]+$/;
    if (!allowedChars.test(cleaned)) {
      return null;
    }

    // Check for suspicious patterns that might indicate injection attempts
    const suspiciousPatterns = [
      /function/i,
      /eval/i,
      /window/i,
      /document/i,
      /console/i,
      /alert/i,
      /prompt/i,
      /[a-zA-Z_$][a-zA-Z0-9_$]*/, // Variable names or function calls
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(cleaned)) {
        return null;
      }
    }

    return cleaned;
  }

  /**
   * Tokenizes the expression into numbers and operators
   *
   * Parses the sanitized expression string into an array of tokens
   * where each token is either a number or an operator string.
   *
   * @param expression - Sanitized mathematical expression
   * @returns Array of tokens (numbers and operator strings)
   * @throws {Error} If expression contains invalid numbers or characters
   *
   * @internal
   */
  private static tokenize(expression: string): (number | string)[] {
    const tokens: (number | string)[] = [];
    let currentNumber = "";

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (this.OPERATORS.includes(char)) {
        if (currentNumber) {
          const num = parseFloat(currentNumber);
          if (isNaN(num)) {
            throw new Error(`Invalid number: ${currentNumber}`);
          }
          tokens.push(num);
          currentNumber = "";
        }
        tokens.push(char);
      } else if ((char >= "0" && char <= "9") || char === ".") {
        currentNumber += char;
      } else {
        throw new Error(`Invalid character: ${char}`);
      }
    }

    if (currentNumber) {
      const num = parseFloat(currentNumber);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${currentNumber}`);
      }
      tokens.push(num);
    }

    return tokens;
  }

  /**
   * Evaluates tokenized expression using the Shunting Yard algorithm
   *
   * Converts infix notation to postfix (Reverse Polish Notation) and evaluates.
   * This algorithm correctly handles operator precedence and parentheses.
   *
   * @param tokens - Array of tokens from tokenize()
   * @returns The computed result
   * @throws {Error} If expression is malformed (mismatched parentheses, etc.)
   *
   * @see {@link https://en.wikipedia.org/wiki/Shunting_yard_algorithm}
   *
   * @internal
   */
  private static evaluateTokens(tokens: (number | string)[]): number {
    const outputQueue: (number | string)[] = [];
    const operatorStack: string[] = [];

    // Convert to postfix notation (Reverse Polish Notation)
    for (const token of tokens) {
      if (typeof token === "number") {
        outputQueue.push(token);
      } else if (token === "(") {
        operatorStack.push(token);
      } else if (token === ")") {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== "("
        ) {
          const op = operatorStack.pop()!;
          outputQueue.push(op);
        }
        operatorStack.pop(); // Remove the '('
      } else if (this.PRECEDENCE[token as keyof typeof this.PRECEDENCE]) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== "(" &&
          this.PRECEDENCE[
            operatorStack[
              operatorStack.length - 1
            ] as keyof typeof this.PRECEDENCE
          ] >= this.PRECEDENCE[token as keyof typeof this.PRECEDENCE]
        ) {
          const op = operatorStack.pop()!;
          outputQueue.push(op);
        }
        operatorStack.push(token);
      }
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!;
      if (op === "(" || op === ")") {
        throw new Error("Mismatched parentheses");
      }
      outputQueue.push(op);
    }

    // Evaluate postfix expression
    const stack: number[] = [];
    for (const token of outputQueue) {
      if (typeof token === "number") {
        stack.push(token);
      } else {
        if (stack.length < 2) {
          throw new Error("Invalid expression");
        }
        const b = stack.pop()!;
        const a = stack.pop()!;

        switch (token) {
          case "+":
            stack.push(a + b);
            break;
          case "-":
            stack.push(a - b);
            break;
          case "*":
            stack.push(a * b);
            break;
          case "/":
            if (b === 0) {
              throw new Error("Division by zero");
            }
            stack.push(a / b);
            break;
          default:
            throw new Error(`Unknown operator: ${token}`);
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error("Invalid expression");
    }

    return stack[0];
  }
}

/**
 * Convenience function for safe mathematical expression parsing
 *
 * Wrapper around SafeMathParser.parse() that returns just the numeric value.
 * Useful when you don't need the success/error information.
 *
 * @param expression - Math expression to parse (e.g., "2 + 3 * 4")
 * @param defaultValue - Value to return if parsing fails (default: 0)
 * @returns Parsed number or default value
 *
 * @example
 * ```typescript
 * const result = safeParseMath("10 / 2"); // => 5
 * const invalid = safeParseMath("bad input", 100); // => 100
 * ```
 *
 * @public
 */
export function safeParseMath(
  expression: string,
  defaultValue: number = 0,
): number {
  const result = SafeMathParser.parse(expression, defaultValue);
  return result.value;
}
