/**
 * Automated Verification Test Suite
 * Tests Regex Parsing, Thompson's Construction, Subset Construction,
 * Hopcroft's Minimization, and String Simulations.
 */

import { parseRegex, insertConcatOperators, infixToPostfix } from './js/regex-parser.js';
import { buildNFAFromPostfix } from './js/nfa.js';
import { buildDFAFromNFA } from './js/dfa.js';
import { minimizeDFA } from './js/minimizer.js';
import { simulateDFA } from './js/simulator.js';

const testCases = [
  {
    regex: '(a|b)*abb',
    accept: ['abb', 'aabb', 'babb', 'ababb', 'bbabb', 'aaaaabb'],
    reject: ['', 'a', 'b', 'ab', 'ba', 'abba', 'abbb', 'bbaa']
  },
  {
    regex: 'a(b|c)*d',
    accept: ['ad', 'abd', 'acd', 'abbd', 'abcd', 'acbd', 'abccbbd'],
    reject: ['', 'a', 'd', 'abc', 'b', 'add', 'aed']
  },
  {
    regex: '(0|1)*00(0|1)*',
    accept: ['00', '100', '001', '110011', '010010', '000'],
    reject: ['', '0', '1', '01', '10', '010101', '101010']
  },
  {
    regex: '(a|b)*a(a|b)',
    // Language: all strings over {a, b} where the second symbol from the right end is 'a'
    // (i.e. ending in 'aa' or 'ab')
    accept: ['aa', 'ab', 'aaa', 'aab', 'baa', 'bab', 'bbaa', 'bbab', 'abbab'],
    reject: ['', 'a', 'b', 'ba', 'bb', 'bbb', 'bba', 'bbabb', 'babbb']
  },
  {
    regex: 'a+b*',
    accept: ['a', 'ab', 'abb', 'abbb', 'aa', 'aab', 'aaaa'],
    reject: ['', 'b', 'bb', 'ba']
  },
  {
    regex: 'a?b',
    accept: ['b', 'ab'],
    reject: ['', 'a', 'aab', 'ba']
  }
];

let totalPassed = 0;
let totalFailed = 0;

console.log('====================================================');
console.log('🧪 RUNNING TOC REGEX -> DFA AUTOMATED TEST SUITE');
console.log('====================================================\n');

for (const tc of testCases) {
  try {
    const parsed = parseRegex(tc.regex);
    const nfa = buildNFAFromPostfix(parsed.tokens, parsed.alphabet);
    const dfa = buildDFAFromNFA(nfa, parsed.alphabet);
    const minDFA = minimizeDFA(dfa);

    console.log(`Regex: /${tc.regex}/`);
    console.log(`  Postfix: ${parsed.postfix}`);
    console.log(`  NFA States: ${nfa.states.size}, DFA States: ${dfa.states.length}, Minimized DFA States: ${minDFA.states.length}`);

    let tcPassed = true;

    // Test accept strings
    for (const str of tc.accept) {
      const resDFA = simulateDFA(dfa, str);
      const resMin = simulateDFA(minDFA, str);

      if (!resDFA.accepted || !resMin.accepted) {
        console.error(`  ❌ FAIL: String "${str}" should be ACCEPTED! (DFA: ${resDFA.accepted}, MinDFA: ${resMin.accepted})`);
        tcPassed = false;
        totalFailed++;
      } else {
        totalPassed++;
      }
    }

    // Test reject strings
    for (const str of tc.reject) {
      const resDFA = simulateDFA(dfa, str);
      const resMin = simulateDFA(minDFA, str);

      if (resDFA.accepted || resMin.accepted) {
        console.error(`  ❌ FAIL: String "${str}" should be REJECTED! (DFA: ${resDFA.accepted}, MinDFA: ${resMin.accepted})`);
        tcPassed = false;
        totalFailed++;
      } else {
        totalPassed++;
      }
    }

    if (tcPassed) {
      console.log(`  ✅ All test strings matched expected language!\n`);
    } else {
      console.log(`  ⚠️ Some test strings failed for /${tc.regex}/\n`);
    }
  } catch (err) {
    console.error(`  💥 ERROR parsing /${tc.regex}/:`, err.message);
    totalFailed++;
  }
}

console.log('====================================================');
console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed.`);
console.log('====================================================');

if (totalFailed > 0) {
  process.exit(1);
}
