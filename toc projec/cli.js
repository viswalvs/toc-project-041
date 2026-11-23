#!/usr/bin/env node

/**
 * Command Line Interface for TOC Regex to DFA Converter
 * Usage:
 *   node cli.js "(a|b)*abb"
 *   node cli.js "(0|1)*00" --test 00 100 010 1100
 */

import { parseRegex, EPSILON } from './js/regex-parser.js';
import { buildNFAFromPostfix } from './js/nfa.js';
import { buildDFAFromNFA } from './js/dfa.js';
import { minimizeDFA } from './js/minimizer.js';
import { simulateDFA } from './js/simulator.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   THEORY OF COMPUTATION: REGULAR EXPRESSION TO DFA CONVERTER     ║
╚══════════════════════════════════════════════════════════════════╝

Usage:
  node cli.js "<regex>" [options]

Examples:
  node cli.js "(a|b)*abb"
  node cli.js "(0|1)*00(0|1)*" --test 00 1001 0101
  node cli.js "a(b|c)*d" --test ad abbd acbd bcd

Options:
  --test <s1> <s2> ...   Simulate one or more input strings on the Minimized DFA
  --union-plus           Treat '+' as binary union operator (e.g. a+b)
  --help, -h             Display this help message
`);
  process.exit(0);
}

// Parse arguments
let rawRegex = null;
const testStrings = [];
let unionPlus = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--union-plus') {
    unionPlus = true;
  } else if (arg === '--test') {
    i++;
    while (i < args.length && !args[i].startsWith('--')) {
      testStrings.push(args[i]);
      i++;
    }
    i--;
  } else if (!arg.startsWith('--') && !rawRegex) {
    rawRegex = arg;
  }
}

if (!rawRegex) {
  console.error('Error: Please provide a regular expression.');
  process.exit(1);
}

console.log('\n================================================================');
console.log('  🔍 REGEX PREPROCESSING & PARSING');
console.log('================================================================');

try {
  const parsed = parseRegex(rawRegex, { unionPlus });
  console.log(`Input Infix Regex:        ${parsed.raw}`);
  console.log(`Explicit Concat Notation: ${parsed.withConcat}`);
  console.log(`Postfix (RPN):            ${parsed.postfix}`);
  console.log(`Alphabet Σ:               { ${parsed.alphabet.join(', ')} }`);

  // Build ε-NFA
  const nfa = buildNFAFromPostfix(parsed.tokens, parsed.alphabet);
  console.log('\n================================================================');
  console.log("  ⚡ THOMPSON'S CONSTRUCTION (ε-NFA)");
  console.log('================================================================');
  console.log(`Total States:      ${nfa.states.size}`);
  console.log(`Start State:       q${nfa.startState}`);
  console.log(`Accepting States:  { ${Array.from(nfa.acceptStates).map(s => `q${s}`).join(', ')} }`);

  // Build DFA
  const dfa = buildDFAFromNFA(nfa, parsed.alphabet);
  console.log('\n================================================================');
  console.log('  🧩 SUBSET CONSTRUCTION (DFA)');
  console.log('================================================================');
  console.log(`Total States:      ${dfa.states.length}`);
  console.log(`Start State:       ${dfa.startState?.name || 'none'}`);
  console.log(`Accepting States:  { ${Array.from(dfa.acceptStates).map(s => s.name).join(', ')} }`);
  console.log('\nDFA State Mappings (Subsets of NFA states):');
  for (const s of dfa.states) {
    console.log(`  State ${s.name.padEnd(3)} = ${s.nfaStatesFormatted.padEnd(20)} ${s.isStart ? '[START] ' : ''}${s.isAccept ? '[ACCEPT]' : ''}`);
  }

  // Minimize DFA
  const minDFA = minimizeDFA(dfa);
  console.log('\n================================================================');
  console.log("  🎯 HOPCROFT'S MINIMIZATION (MINIMIZED DFA)");
  console.log('================================================================');
  console.log(`Total States:      ${minDFA.states.length} (reduced from ${dfa.states.length})`);
  console.log(`Start State:       ${minDFA.startState?.name || 'none'}`);
  console.log(`Accepting States:  { ${Array.from(minDFA.acceptStates).map(s => s.name).join(', ')} }`);

  console.log('\nMinimized DFA Transition Table:');
  const tableData = minDFA.getTransitionTable();
  const headerLine = `  State | Merged States     | ` + tableData.alphabet.map(a => a.padEnd(5)).join(' | ');
  console.log(headerLine);
  console.log('  ' + '-'.repeat(headerLine.length - 2));

  for (const row of tableData.rows) {
    const stateStr = row.label.padEnd(5);
    const origStr = row.originalGroup.padEnd(17);
    const transStr = tableData.alphabet.map(a => (row.cells[a] || '—').padEnd(5)).join(' | ');
    console.log(`  ${stateStr} | ${origStr} | ${transStr}`);
  }

  // String Testing
  if (testStrings.length > 0) {
    console.log('\n================================================================');
    console.log('  🧪 STRING SIMULATION & VERIFICATION');
    console.log('================================================================');

    for (const str of testStrings) {
      const inputStr = (str === '""' || str === "''" || str === 'eps' || str === EPSILON) ? '' : str;
      const res = simulateDFA(minDFA, inputStr);
      const verdict = res.accepted ? '✅ ACCEPTED' : '❌ REJECTED';
      const pathStr = res.trace.map(t => t.currentState).join(' -> ');

      console.log(`\nInput: "${inputStr === '' ? 'ε' : inputStr}"`);
      console.log(`  Verdict: ${verdict}`);
      console.log(`  Reason:  ${res.reason}`);
      console.log(`  Path:    ${pathStr}`);
    }
  }

  console.log('\n================================================================\n');

} catch (err) {
  console.error('\n❌ Execution Error:', err.message);
  process.exit(1);
}
