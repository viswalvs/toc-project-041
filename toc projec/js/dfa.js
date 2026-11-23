/**
 * Subset Construction Algorithm (Powerset Construction)
 * Converts an ε-NFA into an equivalent Deterministic Finite Automaton (DFA).
 */

import { EPSILON } from './regex-parser.js';

export class DFAState {
  constructor(id, nfaStatesSet, name = null) {
    this.id = id; // Integer ID (0, 1, 2...)
    this.name = name || (id < 26 ? String.fromCharCode(65 + id) : `D${id}`); // A, B, C...
    this.nfaStates = new Set(nfaStatesSet); // Set of NFA state IDs
    this.transitions = new Map(); // symbol -> target DFAState
    this.isStart = false;
    this.isAccept = false;
  }

  get sortedNFAStates() {
    return Array.from(this.nfaStates).sort((a, b) => a - b);
  }

  get key() {
    return this.sortedNFAStates.join(',');
  }

  get nfaStatesFormatted() {
    return `{${this.sortedNFAStates.map(s => `q${s}`).join(', ')}}`;
  }
}

export class DFA {
  constructor() {
    this.states = []; // Array of DFAState
    this.startState = null; // DFAState
    this.acceptStates = new Set(); // Set of DFAState
    this.alphabet = []; // Array of symbols
    this.subsetSteps = []; // Detailed calculation log for display
  }

  getStateById(id) {
    return this.states.find(s => s.id === id);
  }

  getStateByName(name) {
    return this.states.find(s => s.name === name);
  }

  /**
   * Get all transitions in flat list format: [{ from, fromName, symbol, to, toName }]
   */
  getTransitionsList() {
    const list = [];
    for (const state of this.states) {
      for (const [symbol, targetState] of state.transitions.entries()) {
        list.push({
          from: state.id,
          fromName: state.name,
          symbol,
          to: targetState.id,
          toName: targetState.name
        });
      }
    }
    return list;
  }

  /**
   * Generates formatted transition table data for display
   */
  getTransitionTable() {
    const headers = ['DFA State', 'NFA Equivalent Subset', ...this.alphabet];
    const rows = [];

    for (const state of this.states) {
      let label = state.name;
      if (state.isStart && state.isAccept) label = `-> *${state.name}`;
      else if (state.isStart) label = `-> ${state.name}`;
      else if (state.isAccept) label = `*${state.name}`;

      const row = {
        stateId: state.id,
        name: state.name,
        label,
        nfaSubset: state.nfaStatesFormatted,
        isStart: state.isStart,
        isAccept: state.isAccept,
        cells: {}
      };

      for (const symbol of this.alphabet) {
        const target = state.transitions.get(symbol);
        row.cells[symbol] = target ? target.name : '—'; // or trap
      }
      rows.push(row);
    }

    return { headers, rows, alphabet: this.alphabet };
  }
}

/**
 * Computes the ε-closure of a set of NFA states.
 * That is, the set of all states reachable from any state in `stateSet` using only ε-transitions.
 */
export function epsilonClosure(nfa, stateSet) {
  const closure = new Set(stateSet);
  const stack = Array.from(stateSet);

  while (stack.length > 0) {
    const currentId = stack.pop();
    const currentState = nfa.states.get(currentId);
    if (!currentState) continue;

    const epsTargets = currentState.transitions.get(EPSILON);
    if (epsTargets) {
      for (const targetId of epsTargets) {
        if (!closure.has(targetId)) {
          closure.add(targetId);
          stack.push(targetId);
        }
      }
    }
  }

  return closure;
}

/**
 * Computes move(stateSet, symbol) = union of transitions on symbol for all states in stateSet
 */
export function move(nfa, stateSet, symbol) {
  const targetSet = new Set();
  for (const stateId of stateSet) {
    const state = nfa.states.get(stateId);
    if (state) {
      const targets = state.transitions.get(symbol);
      if (targets) {
        for (const targetId of targets) {
          targetSet.add(targetId);
        }
      }
    }
  }
  return targetSet;
}

/**
 * Converts an ε-NFA to a DFA using the Subset Construction algorithm.
 */
export function buildDFAFromNFA(nfa, alphabet = null) {
  const dfa = new DFA();
  const sortedAlphabet = alphabet
    ? Array.from(alphabet).sort()
    : Array.from(nfa.alphabet).sort();
  dfa.alphabet = sortedAlphabet;

  if (nfa.startState === null) {
    return dfa;
  }

  // 1. Initial State: ε-closure of NFA start state
  const startClosure = epsilonClosure(nfa, [nfa.startState]);
  const startKey = Array.from(startClosure).sort((a, b) => a - b).join(',');

  const stateMap = new Map(); // key -> DFAState
  const queue = [];

  const startDFAState = new DFAState(0, startClosure);
  startDFAState.isStart = true;
  // Check if initial DFA state contains any NFA accept state
  for (const s of startClosure) {
    if (nfa.acceptStates.has(s)) {
      startDFAState.isAccept = true;
      break;
    }
  }

  dfa.states.push(startDFAState);
  dfa.startState = startDFAState;
  if (startDFAState.isAccept) {
    dfa.acceptStates.add(startDFAState);
  }
  stateMap.set(startKey, startDFAState);
  queue.push(startDFAState);

  let stateCounter = 1;

  // 2. Process worklist queue
  while (queue.length > 0) {
    const currentDFAState = queue.shift();
    const stepRow = {
      stateName: currentDFAState.name,
      nfaSubset: currentDFAState.nfaStatesFormatted,
      isAccept: currentDFAState.isAccept,
      transitions: {}
    };

    for (const symbol of sortedAlphabet) {
      const moveSet = move(nfa, currentDFAState.nfaStates, symbol);
      const closureSet = epsilonClosure(nfa, moveSet);

      const moveArray = Array.from(moveSet).sort((a, b) => a - b);
      const closureArray = Array.from(closureSet).sort((a, b) => a - b);

      if (closureArray.length === 0) {
        stepRow.transitions[symbol] = {
          move: moveArray.length > 0 ? `{${moveArray.map(s => `q${s}`).join(', ')}}` : '∅',
          closure: '∅',
          targetName: '—'
        };
        continue;
      }

      const key = closureArray.join(',');
      let targetDFAState;

      if (stateMap.has(key)) {
        targetDFAState = stateMap.get(key);
      } else {
        targetDFAState = new DFAState(stateCounter++, closureSet);
        for (const s of closureSet) {
          if (nfa.acceptStates.has(s)) {
            targetDFAState.isAccept = true;
            break;
          }
        }
        dfa.states.push(targetDFAState);
        if (targetDFAState.isAccept) {
          dfa.acceptStates.add(targetDFAState);
        }
        stateMap.set(key, targetDFAState);
        queue.push(targetDFAState);
      }

      currentDFAState.transitions.set(symbol, targetDFAState);

      stepRow.transitions[symbol] = {
        move: `{${moveArray.map(s => `q${s}`).join(', ')}}`,
        closure: `{${closureArray.map(s => `q${s}`).join(', ')}}`,
        targetName: targetDFAState.name
      };
    }

    dfa.subsetSteps.push(stepRow);
  }

  return dfa;
}
