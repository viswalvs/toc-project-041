/**
 * Regex Parser & Preprocessor
 * Handles tokenization, explicit concatenation insertion, and Infix to Postfix conversion
 * using the Shunting-Yard Algorithm.
 */

export const EPSILON = 'ε';

// Operators definition
export const OPERATORS = {
  KLEENE: '*',
  PLUS: '+',
  OPTIONAL: '?',
  CONCAT: '·', // using middle dot for visual clarity in AST/postfix
  UNION: '|'
};

const PRECEDENCE = {
  [OPERATORS.KLEENE]: 4,
  [OPERATORS.PLUS]: 4,
  [OPERATORS.OPTIONAL]: 4,
  [OPERATORS.CONCAT]: 3,
  [OPERATORS.UNION]: 2,
  '(': 1
};

/**
 * Checks if a character/token is an operand (letter, digit, epsilon, etc.)
 */
export function isOperand(token) {
  if (!token) return false;
  return (
    token !== OPERATORS.UNION &&
    token !== OPERATORS.CONCAT &&
    token !== OPERATORS.KLEENE &&
    token !== OPERATORS.PLUS &&
    token !== OPERATORS.OPTIONAL &&
    token !== '(' &&
    token !== ')'
  );
}

/**
 * Normalizes input regex string:
 * - standardizes epsilon representations (e.g., 'eps', 'epsilon', '@', 'lambda' -> 'ε')
 * - handles binary '+' as union if chosen or standard '|'
 * - strips unneeded whitespace
 */
export function normalizeRegex(regexStr, options = { unionPlus: false }) {
  if (!regexStr || typeof regexStr !== 'string') return '';
  let str = regexStr.trim();

  // Normalize epsilon representations
  str = str.replace(/\\epsilon|epsilon|eps|\\lambda|lambda|@/gi, EPSILON);

  // If unionPlus is enabled, convert '+' used as binary union to '|'
  // (e.g. 'a+b' where + is not following an operator or at start)
  if (options.unionPlus) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '+') {
        const prev = i > 0 ? str[i - 1] : null;
        const next = i < str.length - 1 ? str[i + 1] : null;
        // If preceded by an operand or ')' or '*' and followed by an operand or '(', treat as union
        if (prev && next && (isOperand(prev) || prev === ')' || prev === '*' || prev === '?') &&
            (isOperand(next) || next === '(')) {
          out += '|';
          continue;
        }
      }
      out += c;
    }
    str = out;
  }

  return str;
}

/**
 * Inserts explicit concatenation operators '·' into the regex string
 */
export function insertConcatOperators(regexStr) {
  let result = '';
  for (let i = 0; i < regexStr.length; i++) {
    const current = regexStr[i];
    result += current;

    if (i + 1 < regexStr.length) {
      const next = regexStr[i + 1];

      // Conditions to insert concatenation '·' between current and next:
      // 1. current is operand, next is operand: e.g. "ab" -> "a·b"
      // 2. current is operand, next is '(': e.g. "a(" -> "a·("
      // 3. current is post-unary operator (*, +, ?), next is operand: e.g. "a*b" -> "a*·b"
      // 4. current is post-unary operator (*, +, ?), next is '(': e.g. "a*(" -> "a*·("
      // 5. current is ')', next is operand: e.g. ")a" -> ")·a"
      // 6. current is ')', next is '(': e.g. ")(" -> ")·("

      const isCurrentOperand = isOperand(current);
      const isNextOperand = isOperand(next);

      const isCurrentPostUnary =
        current === OPERATORS.KLEENE ||
        current === OPERATORS.PLUS ||
        current === OPERATORS.OPTIONAL;

      if (
        (isCurrentOperand && isNextOperand) ||
        (isCurrentOperand && next === '(') ||
        (isCurrentPostUnary && isNextOperand) ||
        (isCurrentPostUnary && next === '(') ||
        (current === ')' && isNextOperand) ||
        (current === ')' && next === '(')
      ) {
        result += OPERATORS.CONCAT;
      }
    }
  }
  return result;
}

/**
 * Converts infix regular expression with explicit concatenation to postfix notation
 * using the Shunting-Yard algorithm.
 * Returns { postfix: string, steps: Array<{token, stack, output, action}> }
 */
export function infixToPostfix(regexWithConcat) {
  const output = [];
  const stack = [];
  const steps = [];

  for (let i = 0; i < regexWithConcat.length; i++) {
    const token = regexWithConcat[i];

    if (isOperand(token)) {
      output.push(token);
      steps.push({
        token,
        stack: stack.join(''),
        output: output.join(''),
        action: `Push operand '${token}' to output`
      });
    } else if (token === '(') {
      stack.push(token);
      steps.push({
        token,
        stack: stack.join(''),
        output: output.join(''),
        action: `Push '(' to operator stack`
      });
    } else if (token === ')') {
      let matched = false;
      while (stack.length > 0) {
        const top = stack.pop();
        if (top === '(') {
          matched = true;
          break;
        }
        output.push(top);
      }
      if (!matched) {
        throw new Error('Mismatched parentheses: unexpected closing bracket `)`');
      }
      steps.push({
        token,
        stack: stack.join(''),
        output: output.join(''),
        action: `Pop operators until '(' into output`
      });
    } else {
      // Unary operators (*, +, ?) have highest precedence and are postfix
      if (token === OPERATORS.KLEENE || token === OPERATORS.PLUS || token === OPERATORS.OPTIONAL) {
        // Unary postfix operators can be immediately placed in postfix or handled via stack
        // In standard shunting-yard for unary postfix, we output it after its operand
        output.push(token);
        steps.push({
          token,
          stack: stack.join(''),
          output: output.join(''),
          action: `Append unary operator '${token}' directly to output`
        });
      } else {
        // Binary operators ('|', '·')
        while (
          stack.length > 0 &&
          stack[stack.length - 1] !== '(' &&
          (PRECEDENCE[stack[stack.length - 1]] || 0) >= (PRECEDENCE[token] || 0)
        ) {
          output.push(stack.pop());
        }
        stack.push(token);
        steps.push({
          token,
          stack: stack.join(''),
          output: output.join(''),
          action: `Push operator '${token}' to stack (after popping higher/equal precedence)`
        });
      }
    }
  }

  while (stack.length > 0) {
    const top = stack.pop();
    if (top === '(' || top === ')') {
      throw new Error('Mismatched parentheses: unmatched opening bracket `(`');
    }
    output.push(top);
    steps.push({
      token: 'EOF',
      stack: stack.join(''),
      output: output.join(''),
      action: `Pop remaining '${top}' to output`
    });
  }

  return {
    postfix: output.join(''),
    tokens: output,
    steps
  };
}

/**
 * Full parsing pipeline:
 * Input raw regex -> normalized -> explicit concat -> postfix
 */
export function parseRegex(rawInput, options = {}) {
  if (!rawInput || rawInput.trim() === '') {
    throw new Error('Empty regular expression');
  }
  const normalized = normalizeRegex(rawInput, options);
  const withConcat = insertConcatOperators(normalized);
  const postfixResult = infixToPostfix(withConcat);

  // Extract alphabet (all unique operands excluding epsilon)
  const alphabetSet = new Set();
  for (const char of postfixResult.postfix) {
    if (isOperand(char) && char !== EPSILON) {
      alphabetSet.add(char);
    }
  }

  const alphabet = Array.from(alphabetSet).sort();

  return {
    raw: rawInput,
    normalized,
    withConcat,
    postfix: postfixResult.postfix,
    tokens: postfixResult.tokens,
    steps: postfixResult.steps,
    alphabet
  };
}
