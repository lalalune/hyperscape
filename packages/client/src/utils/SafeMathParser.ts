/**
 * Safe Math Parser
 * Replaces dangerous eval() usage with a secure mathematical expression parser
 * Supports basic arithmetic operations: +, -, *, /, (), decimal numbers
 */

import type { ParseResult } from '@hyperscape/shared';

export class SafeMathParser {
  private static readonly OPERATORS = ['+', '-', '*', '/', '(', ')'];
  private static readonly PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

  /**
   * Safely parse and evaluate a mathematical expression
   * @param expression The math expression string
   * @param fallback Fallback value if parsing fails
   * @returns ParseResult with success status and value
   */
  static parse(expression: string, fallback: number = 0): ParseResult {
    // Input validation and sanitization
    const sanitized = this.sanitizeInput(expression);
    if (!sanitized) {
      return { success: false, value: fallback, error: 'Invalid characters in expression' };
    }

    // Handle simple numeric input
    const simpleNumber = parseFloat(sanitized);
    if (!isNaN(simpleNumber) && sanitized === simpleNumber.toString()) {
      return { success: true, value: simpleNumber };
    }

    // Parse and evaluate expression
    const tokens = this.tokenize(sanitized);
    if (tokens.length === 0) {
      return { success: false, value: fallback, error: 'Empty expression' };
    }

    const result = this.evaluateTokens(tokens);
    
    if (isNaN(result) || !isFinite(result)) {
      return { success: false, value: fallback, error: 'Result is not a valid number' };
    }

    return { success: true, value: result };
  }

  /**
   * Sanitize input to only allow safe mathematical characters
   */
  private static sanitizeInput(input: string): string | null {
    // Remove all whitespace
    const cleaned = input.replace(/\s/g, '');
    
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
      /[a-zA-Z_$][a-zA-Z0-9_$]*/  // Variable names or function calls
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(cleaned)) {
        return null;
      }
    }

    return cleaned;
  }

  /**
   * Tokenize the expression into numbers and operators
   */
  private static tokenize(expression: string): (number | string)[] {
    const tokens: (number | string)[] = [];
    let currentNumber = '';

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (this.OPERATORS.includes(char)) {
        if (currentNumber) {
          const num = parseFloat(currentNumber);
          if (isNaN(num)) {
            throw new Error(`Invalid number: ${currentNumber}`);
          }
          tokens.push(num);
          currentNumber = '';
        }
        tokens.push(char);
      } else if (char >= '0' && char <= '9' || char === '.') {
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
   * Evaluate tokenized expression using shunting-yard algorithm
   */
  private static evaluateTokens(tokens: (number | string)[]): number {
    const outputQueue: (number | string)[] = [];
    const operatorStack: string[] = [];

    // Convert to postfix notation (Reverse Polish Notation)
    for (const token of tokens) {
      if (typeof token === 'number') {
        outputQueue.push(token);
      } else if (token === '(') {
        operatorStack.push(token);
      } else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          const op = operatorStack.pop()!;
          outputQueue.push(op);
        }
        operatorStack.pop(); // Remove the '('
      } else if (this.PRECEDENCE[token as keyof typeof this.PRECEDENCE]) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          this.PRECEDENCE[operatorStack[operatorStack.length - 1] as keyof typeof this.PRECEDENCE] >= 
          this.PRECEDENCE[token as keyof typeof this.PRECEDENCE]
        ) {
          const op = operatorStack.pop()!;
          outputQueue.push(op);
        }
        operatorStack.push(token);
      }
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!;
      if (op === '(' || op === ')') {
        throw new Error('Mismatched parentheses');
      }
      outputQueue.push(op);
    }

    // Evaluate postfix expression
    const stack: number[] = [];
    for (const token of outputQueue) {
      if (typeof token === 'number') {
        stack.push(token);
      } else {
        if (stack.length < 2) {
          throw new Error('Invalid expression');
        }
        const b = stack.pop()!;
        const a = stack.pop()!;
        
        switch (token) {
          case '+':
            stack.push(a + b);
            break;
          case '-':
            stack.push(a - b);
            break;
          case '*':
            stack.push(a * b);
            break;
          case '/':
            if (b === 0) {
              throw new Error('Division by zero');
            }
            stack.push(a / b);
            break;
          default:
            throw new Error(`Unknown operator: ${token}`);
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid expression');
    }

    return stack[0];
  }
}

/**
 * Convenience function for simple safe math parsing
 * @param expression Math expression to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed number or fallback
 */
export function safeParseMath(expression: string, fallback: number = 0): number {
  const result = SafeMathParser.parse(expression, fallback);
  return result.value;
}