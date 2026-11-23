/**
 * Thompson's Construction Algorithm
 * Converts Postfix Regular Expression into an ε-NFA (Non-Deterministic Finite Automaton).
 */

import { OPERATORS, EPSILON, isOperand } from './regex-parser.js';

export class NFAState {
  constructor(id) {
    this.id = id;
    // Map: symbol -> Set of destination state IDs
    this.transitions = new Map();
  }

  addTransition(symbol, targetStateId) {
    if (!this.transitions.has(symbol)) {
      this.transitions.set(symbol, new Set());
    }
    this.transitions.get(symbol).add(targetStateId);
  }
}

export class NFAFragment {
  constructor(startStateId, acceptStateId) {
    this.start = startStateId;
    this.accept = acceptStateId;
  }
}

export class NFA {
  constructor() {
    this.states = new Map(); // id -> NFAState
    this.startState = null;
    this.acceptStates = new Set();
    this.alphabet = new Set();
    this.stateCounter = 0;
    this.constructionSteps = [];
  }

  createState() {
    const id = this.stateCounter++;
    const state = new NFAState(id);
    this.states.set(id, state);
    return id;
  }

  addTransition(fromId, symbol, toId) {
    if (!this.states.has(fromId)) this.createState();
    if (!this.states.has(toId)) this.createState();

    this.states.get(fromId).addTransition(symbol, toId);
    if (symbol !== EPSILON) {
      this.alphabet.add(symbol);
    }
  }

  /**
   * Get all transitions in flat list format: [{ from, symbol, to }]
   */
  getTransitionsList() {
    const list = [];
    for (const [fromId, state] of this.states.entries()) {
      for (const [symbol, targets] of state.transitions.entries()) {
        for (const targetId of targets) {
          list.push({ from: fromId, symbol, to: targetId });
        }
      }
    }
    return list;
  }

  /**
   * Generates formatted transition table data for display
   */
  getTransitionTable(orderedAlphabet = null) {
    const alphabetList = orderedAlphabet ? Array.from(orderedAlphabet) : Array.from(this.alphabet).sort();
    const headers = ['State', ...alphabetList, EPSILON];
    const rows = [];

    const sortedStates = Array.from(this.states.keys()).sort((a, b) => a - b);
    for (const stateId of sortedStates) {
      const state = this.states.get(stateId);
      const isStart = stateId === this.startState;
      const isAccept = this.acceptStates.has(stateId);

      let label = `q${stateId}`;
      if (isStart && isAccept) label = `-> *q${stateId}`;
      else if (isStart) label = `-> q${stateId}`;
      else if (isAccept) label = `*q${stateId}`;

      const row = {
        stateId,
        label,
        isStart,
        isAccept,
        cells: {}
      };

      for (const symbol of [...alphabetList, EPSILON]) {
        const targets = state.transitions.get(symbol);
        if (targets && targets.size > 0) {
          const targetArray = Array.from(targets).sort((a, b) => a - b);
          row.cells[symbol] = `{${targetArray.map(t => `q${t}`).join(', ')}}`;
        } else {
          row.cells[symbol] = '∅';
        }
      }
      rows.push(row);
    }

    return { headers, rows, alphabet: alphabetList };
  }
}

/**
 * Builds an ε-NFA from a postfix regex using Thompson's Construction.
 */
export function buildNFAFromPostfix(postfixTokens, explicitAlphabet = []) {
  const nfa = new NFA();
  const stack = []; // Stack of NFAFragment
  const steps = [];

  for (const token of postfixTokens) {
    if (isOperand(token)) {
      // Base Case: Single symbol or epsilon
      const startId = nfa.createState();
      const acceptId = nfa.createState();
      nfa.addTransition(startId, token, acceptId);

      const fragment = new NFAFragment(startId, acceptId);
      stack.push(fragment);

      steps.push({
        operator: `Symbol '${token}'`,
        description: `Create initial state q${startId} and accept state q${acceptId} with transition q${startId} --${token}--> q${acceptId}.`,
        fragmentStart: startId,
        fragmentAccept: acceptId
      });
    } else if (token === OPERATORS.CONCAT) {
      // Concatenation: A · B
      if (stack.length < 2) {
        throw new Error('Invalid regular expression: insufficient operands for concatenation');
      }
      const frag2 = stack.pop();
      const frag1 = stack.pop();

      // Connect frag1 accept to frag2 start with epsilon
      nfa.addTransition(frag1.accept, EPSILON, frag2.start);

      const newFrag = new NFAFragment(frag1.start, frag2.accept);
      stack.push(newFrag);

      steps.push({
        operator: 'Concatenation (·)',
        description: `Connect previous fragment's accept state q${frag1.accept} to next fragment's start state q${frag2.start} via ε.`,
        fragmentStart: newFrag.start,
        fragmentAccept: newFrag.accept
      });
    } else if (token === OPERATORS.UNION) {
      // Union: A | B
      if (stack.length < 2) {
        throw new Error('Invalid regular expression: insufficient operands for alternation');
      }
      const frag2 = stack.pop();
      const frag1 = stack.pop();

      const newStart = nfa.createState();
      const newAccept = nfa.createState();

      // Epsilon transitions from newStart to both branch starts
      nfa.addTransition(newStart, EPSILON, frag1.start);
      nfa.addTransition(newStart, EPSILON, frag2.start);

      // Epsilon transitions from both branch accepts to newAccept
      nfa.addTransition(frag1.accept, EPSILON, newAccept);
      nfa.addTransition(frag2.accept, EPSILON, newAccept);

      const newFrag = new NFAFragment(newStart, newAccept);
      stack.push(newFrag);

      steps.push({
        operator: 'Union (|)',
        description: `Create new start q${newStart} splitting to q${frag1.start} & q${frag2.start} via ε; converge q${frag1.accept} & q${frag2.accept} into new accept q${newAccept} via ε.`,
        fragmentStart: newFrag.start,
        fragmentAccept: newFrag.accept
      });
    } else if (token === OPERATORS.KLEENE) {
      // Kleene Star: A*
      if (stack.length < 1) {
        throw new Error('Invalid regular expression: insufficient operands for Kleene star');
      }
      const frag = stack.pop();
      const newStart = nfa.createState();
      const newAccept = nfa.createState();

      // New start to fragment start
      nfa.addTransition(newStart, EPSILON, frag.start);
      // New start to new accept (for zero repetitions)
      nfa.addTransition(newStart, EPSILON, newAccept);
      // Fragment accept back to fragment start (for repetition)
      nfa.addTransition(frag.accept, EPSILON, frag.start);
      // Fragment accept to new accept
      nfa.addTransition(frag.accept, EPSILON, newAccept);

      const newFrag = new NFAFragment(newStart, newAccept);
      stack.push(newFrag);

      steps.push({
        operator: 'Kleene Star (*)',
        description: `Create new start q${newStart} and accept q${newAccept}. Add loop q${frag.accept} --ε--> q${frag.start} and bypass q${newStart} --ε--> q${newAccept}.`,
        fragmentStart: newFrag.start,
        fragmentAccept: newFrag.accept
      });
    } else if (token === OPERATORS.PLUS) {
      // One or more: A+
      if (stack.length < 1) {
        throw new Error('Invalid regular expression: insufficient operands for plus');
      }
      const frag = stack.pop();
      const newStart = nfa.createState();
      const newAccept = nfa.createState();

      // Must take at least one pass: newStart to frag.start
      nfa.addTransition(newStart, EPSILON, frag.start);
      // Loop back for repetition
      nfa.addTransition(frag.accept, EPSILON, frag.start);
      // frag accept to new accept
      nfa.addTransition(frag.accept, EPSILON, newAccept);

      const newFrag = new NFAFragment(newStart, newAccept);
      stack.push(newFrag);

      steps.push({
        operator: 'Plus (+)',
        description: `Create new start q${newStart} leading to q${frag.start}. Add loop q${frag.accept} --ε--> q${frag.start} and exit to q${newAccept}.`,
        fragmentStart: newFrag.start,
        fragmentAccept: newFrag.accept
      });
    } else if (token === OPERATORS.OPTIONAL) {
      // Optional: A?
      if (stack.length < 1) {
        throw new Error('Invalid regular expression: insufficient operands for optional (?)');
      }
      const frag = stack.pop();
      const newStart = nfa.createState();
      const newAccept = nfa.createState();

      nfa.addTransition(newStart, EPSILON, frag.start);
      nfa.addTransition(newStart, EPSILON, newAccept);
      nfa.addTransition(frag.accept, EPSILON, newAccept);

      const newFrag = new NFAFragment(newStart, newAccept);
      stack.push(newFrag);

      steps.push({
        operator: 'Optional (?)',
        description: `Create new start q${newStart} with branch to q${frag.start} and bypass directly to q${newAccept} via ε.`,
        fragmentStart: newFrag.start,
        fragmentAccept: newFrag.accept
      });
    }
  }

  if (stack.length !== 1) {
    throw new Error('Malformed regular expression: multiple disconnected components remain');
  }

  const finalFragment = stack.pop();
  nfa.startState = finalFragment.start;
  nfa.acceptStates.add(finalFragment.accept);
  nfa.constructionSteps = steps;

  // Add any explicitly declared alphabet symbols
  for (const sym of explicitAlphabet) {
    if (sym !== EPSILON) nfa.alphabet.add(sym);
  }

  return nfa;
}
