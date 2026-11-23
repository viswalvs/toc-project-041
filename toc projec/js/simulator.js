/**
 * Automata Simulator
 * Validates input strings on DFA, Minimized DFA, or ε-NFA and returns step-by-step traces.
 */

import { epsilonClosure, move } from './dfa.js';
import { EPSILON } from './regex-parser.js';

/**
 * Simulates a string on a DFA (or Minimized DFA).
 */
export function simulateDFA(dfa, inputString) {
  const str = inputString === EPSILON ? '' : inputString;
  const trace = [];

  if (!dfa.startState) {
    return {
      accepted: false,
      trace: [],
      reason: 'DFA has no initial state'
    };
  }

  let currentState = dfa.startState;
  trace.push({
    step: 0,
    char: null,
    fromState: null,
    currentState: currentState.name,
    stateObj: currentState,
    isAccept: currentState.isAccept,
    action: `Start at state ${currentState.name}`
  });

  // Handle empty string
  if (str === '') {
    const accepted = currentState.isAccept;
    return {
      accepted,
      trace,
      finalState: currentState.name,
      reason: accepted
        ? 'Accepted: Empty string reached accepting start state.'
        : 'Rejected: Start state is not an accepting state.'
    };
  }

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextState = currentState.transitions.get(char);

    if (!nextState) {
      trace.push({
        step: i + 1,
        char,
        fromState: currentState.name,
        currentState: 'TRAP / DEAD',
        stateObj: null,
        isAccept: false,
        action: `No transition from ${currentState.name} on '${char}' -> Trap/Rejected`
      });
      return {
        accepted: false,
        trace,
        finalState: 'TRAP',
        reason: `Rejected: No transition defined for character '${char}' from state ${currentState.name}.`
      };
    }

    trace.push({
      step: i + 1,
      char,
      fromState: currentState.name,
      currentState: nextState.name,
      stateObj: nextState,
      isAccept: nextState.isAccept,
      action: `Read '${char}': ${currentState.name} -> ${nextState.name}`
    });

    currentState = nextState;
  }

  const accepted = currentState.isAccept;
  return {
    accepted,
    trace,
    finalState: currentState.name,
    reason: accepted
      ? `Accepted: Finished in accepting state ${currentState.name}.`
      : `Rejected: Finished in non-accepting state ${currentState.name}.`
  };
}

/**
 * Simulates a string on an ε-NFA directly by tracking active subsets via ε-closure.
 */
export function simulateNFA(nfa, inputString) {
  const str = inputString === EPSILON ? '' : inputString;
  const trace = [];

  if (nfa.startState === null) {
    return { accepted: false, trace, reason: 'NFA has no start state' };
  }

  let currentStates = epsilonClosure(nfa, [nfa.startState]);
  const formatStates = s => `{${Array.from(s).sort((a, b) => a - b).map(x => `q${x}`).join(', ')}}`;

  trace.push({
    step: 0,
    char: null,
    currentStates: formatStates(currentStates),
    statesSet: new Set(currentStates),
    action: `Initial state q${nfa.startState} with ε-closure: ${formatStates(currentStates)}`
  });

  if (str === '') {
    const hasAccept = Array.from(currentStates).some(s => nfa.acceptStates.has(s));
    return {
      accepted: hasAccept,
      trace,
      reason: hasAccept
        ? 'Accepted: ε-closure contains an accepting state.'
        : 'Rejected: No accepting state reached for empty string.'
    };
  }

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const moveSet = move(nfa, currentStates, char);
    currentStates = epsilonClosure(nfa, moveSet);

    trace.push({
      step: i + 1,
      char,
      currentStates: formatStates(currentStates),
      statesSet: new Set(currentStates),
      action: `Read '${char}': move=${formatStates(moveSet)} -> closure=${formatStates(currentStates)}`
    });

    if (currentStates.size === 0) {
      return {
        accepted: false,
        trace,
        reason: `Rejected: Automaton reached empty state set after reading '${char}'.`
      };
    }
  }

  const accepted = Array.from(currentStates).some(s => nfa.acceptStates.has(s));
  return {
    accepted,
    trace,
    reason: accepted
      ? `Accepted: Final state set contains accept state.`
      : `Rejected: Final state set does not contain any accept state.`
  };
}
