/**
 * DFA Minimization (Hopcroft's / Equivalence Partition Refinement Algorithm)
 * Minimizes a Deterministic Finite Automaton by finding the coarsest equivalence relation.
 */

export class MinimizedDFAState {
  constructor(id, originalStates, name = null) {
    this.id = id;
    this.name = name || `M${id}`;
    this.originalStates = originalStates; // Array of DFAState
    this.transitions = new Map(); // symbol -> MinimizedDFAState
    this.isStart = false;
    this.isAccept = false;
  }

  get originalNames() {
    return this.originalStates.map(s => s.name).sort().join(',');
  }

  get formattedLabel() {
    return `{${this.originalNames}}`;
  }
}

export class MinimizedDFA {
  constructor() {
    this.states = [];
    this.startState = null;
    this.acceptStates = new Set();
    this.alphabet = [];
    this.partitionHistory = []; // Step-by-step partitions
  }

  getStateById(id) {
    return this.states.find(s => s.id === id);
  }

  getStateByName(name) {
    return this.states.find(s => s.name === name);
  }

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

  getTransitionTable() {
    const headers = ['Minimized State', 'Merged Original States', ...this.alphabet];
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
        originalGroup: state.formattedLabel,
        isStart: state.isStart,
        isAccept: state.isAccept,
        cells: {}
      };

      for (const symbol of this.alphabet) {
        const target = state.transitions.get(symbol);
        row.cells[symbol] = target ? target.name : '—';
      }
      rows.push(row);
    }

    return { headers, rows, alphabet: this.alphabet };
  }
}

/**
 * Eliminates unreachable states from the DFA starting from dfa.startState.
 */
function getReachableStates(dfa) {
  if (!dfa.startState) return [];
  const visited = new Set();
  const queue = [dfa.startState];
  visited.add(dfa.startState);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const target of current.transitions.values()) {
      if (target && !visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  return Array.from(visited);
}

/**
 * Minimizes a given DFA using equivalence partitioning.
 */
export function minimizeDFA(dfa) {
  const minDFA = new MinimizedDFA();
  minDFA.alphabet = [...dfa.alphabet];

  if (!dfa.startState || dfa.states.length === 0) {
    return minDFA;
  }

  // 1. Filter reachable states only
  const reachableStates = getReachableStates(dfa);

  // 2. Initial Partition: P0 = [ Non-Accepting States, Accepting States ]
  const accepting = [];
  const nonAccepting = [];

  for (const state of reachableStates) {
    if (state.isAccept) {
      accepting.push(state);
    } else {
      nonAccepting.push(state);
    }
  }

  let partition = [];
  if (nonAccepting.length > 0) partition.push(nonAccepting);
  if (accepting.length > 0) partition.push(accepting);

  const partitionHistory = [];

  function formatPartition(p) {
    return p.map(group => `{${group.map(s => s.name).sort().join(', ')}}`);
  }

  partitionHistory.push({
    iteration: 0,
    description: 'Initial partition: P₀ = { Non-Accepting, Accepting }',
    groups: formatPartition(partition)
  });

  // Helper: Find which group index in current partition a state belongs to
  function getGroupIndex(p, state) {
    if (!state) return -1;
    for (let i = 0; i < p.length; i++) {
      if (p[i].some(s => s.id === state.id)) {
        return i;
      }
    }
    return -1;
  }

  // 3. Iterative Partition Refinement
  let iteration = 1;
  let partitionChanged = true;

  while (partitionChanged) {
    partitionChanged = false;
    const newPartition = [];

    for (const group of partition) {
      if (group.length <= 1) {
        newPartition.push(group);
        continue;
      }

      // Group states by signature: [groupIndex(target(symbol1)), groupIndex(target(symbol2)), ...]
      const subGroupMap = new Map();

      for (const state of group) {
        const sigParts = [];
        for (const symbol of dfa.alphabet) {
          const target = state.transitions.get(symbol);
          const targetGroup = getGroupIndex(partition, target);
          sigParts.push(`${symbol}:${targetGroup}`);
        }
        const signature = sigParts.join('|');

        if (!subGroupMap.has(signature)) {
          subGroupMap.set(signature, []);
        }
        subGroupMap.get(signature).push(state);
      }

      const subGroups = Array.from(subGroupMap.values());
      if (subGroups.length > 1) {
        partitionChanged = true;
      }

      for (const sg of subGroups) {
        newPartition.push(sg);
      }
    }

    partition = newPartition;
    partitionHistory.push({
      iteration,
      description: partitionChanged
        ? `Iteration ${iteration}: Refined groups based on transition equivalence.`
        : `Iteration ${iteration}: Stable partition reached (no further splitting).`,
      groups: formatPartition(partition)
    });

    iteration++;
    if (iteration > 100) break; // Safeguard against theoretical edge loops
  }

  minDFA.partitionHistory = partitionHistory;

  // 4. Construct Minimized DFA from final partition groups
  // Sort groups so that the group containing the original start state comes first!
  partition.sort((g1, g2) => {
    const g1HasStart = g1.some(s => s.id === dfa.startState.id);
    const g2HasStart = g2.some(s => s.id === dfa.startState.id);
    if (g1HasStart) return -1;
    if (g2HasStart) return 1;
    return 0;
  });

  const groupToMinState = new Map();

  for (let i = 0; i < partition.length; i++) {
    const group = partition[i];
    const name = i < 26 ? `M${i}` : `M_${i}`;
    const minState = new MinimizedDFAState(i, group, name);

    minState.isStart = group.some(s => s.id === dfa.startState.id);
    minState.isAccept = group.some(s => s.isAccept);

    if (minState.isStart) minDFA.startState = minState;
    if (minState.isAccept) minDFA.acceptStates.add(minState);

    minDFA.states.push(minState);
    for (const originalState of group) {
      groupToMinState.set(originalState.id, minState);
    }
  }

  // 5. Add Transitions to Minimized DFA
  for (let i = 0; i < partition.length; i++) {
    const group = partition[i];
    const minState = minDFA.states[i];
    const representative = group[0];

    for (const symbol of dfa.alphabet) {
      const targetOriginal = representative.transitions.get(symbol);
      if (targetOriginal) {
        const targetMinState = groupToMinState.get(targetOriginal.id);
        if (targetMinState) {
          minState.transitions.set(symbol, targetMinState);
        }
      }
    }
  }

  return minDFA;
}
