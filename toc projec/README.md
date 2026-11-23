# Regular Expression to DFA Converter & Simulator

> **Theory of Computation (TOC) / Formal Languages and Automata Project**  
> A complete, interactive pipeline converting Regular Expressions into Minimal Deterministic Finite Automata (DFA) with step-by-step mathematical proofs, SVG state diagrams, transition tables, and an interactive string simulator.

---

## 🌟 Key Features

1. **Full Algorithmic Conversion Pipeline**:
   - **Infix to Postfix Converter**: Automatic explicit concatenation insertion (`·`) and operator precedence via Dijkstra's **Shunting-Yard Algorithm**.
   - **Thompson's Construction**: Inductively builds an $\epsilon$-NFA with canonical structural fragments.
   - **Subset Construction (Powerset Construction)**: Computes $\epsilon$-closures and maps NFA state subsets to deterministic DFA states.
   - **Hopcroft's Minimization**: Refines state equivalence partitions ($P_0 = \{F, Q \setminus F\}$) until a minimal DFA is obtained.
2. **Interactive Visualizer (SVG)**:
   - Smooth layout with start arrow, double circles for final states, directed curved transitions, and self-loops.
   - **Draggable states**, pan, and zoom controls.
   - State highlighting during simulation.
3. **Interactive String Simulator**:
   - Step-by-step token stepper with active state tracking.
   - Instant acceptance/rejection detection with execution paths.
   - Multi-string batch verification suite.
4. **Transition Tables & Formal Proofs**:
   - Formatted transition tables for $\epsilon$-NFA, DFA, and Minimized DFA.
   - Detailed subset construction log ($\text{move}$ and $\epsilon\text{-closure}$).
   - Hopcroft partition iterations log.
5. **Academic Export Capabilities**:
   - One-click **Download SVG** for diagrams.
   - **Copy LaTeX Table** for papers and assignments.
   - **Copy Markdown Table** for reports.
6. **Dual Mode**:
   - Rich **Web Interface** (zero external dependencies).
   - High-speed **CLI Tool** (`node cli.js`) for scripting and terminal presentations.

---

## 📁 Project Architecture

```
toc projec/
├── index.html            # Interactive Web UI layout
├── start.bat             # One-click Windows launcher
├── package.json          # Node project manifest (npm start, npm run cli, npm test)
├── server.js             # Zero-dependency local HTTP static server
├── cli.js                # Command-line interface for terminal usage
├── test.js               # Automated test suite (76/76 test cases)
├── README.md             # Theoretical documentation & manual
├── css/
│   └── styles.css        # Responsive styling with Dark & Light theme
└── js/
    ├── regex-parser.js   # Tokenizer, concat insertion, Shunting-Yard postfix
    ├── nfa.js            # Thompson's Construction (ε-NFA)
    ├── dfa.js            # Subset Construction & ε-closure
    ├── minimizer.js      # Hopcroft's Equivalence Partition Refinement
    ├── visualizer.js     # Interactive SVG automata renderer (drag, zoom, pan)
    ├── simulator.js      # Automata execution tracer & string validator
    └── app.js            # Frontend application controller
```

---

## 🚀 Quickstart Guide

### Method 1: Web Application (Recommended)

1. **Using the one-click launcher (Windows)**:
   Double-click `start.bat`. It will launch your default web browser at `http://localhost:5000`.

2. **Using npm**:
   ```bash
   npm start
   ```
   Then open `http://localhost:5000` in any browser.

---

### Method 2: Command Line Interface (CLI)

Run conversions directly in your terminal:

```bash
# Convert regex and show all tables
node cli.js "(a|b)*abb"

# Convert regex and test multiple strings
node cli.js "(a|b)*abb" --test abb aabb babb ab a

# Substring example with binary alphabet
node cli.js "(0|1)*00(0|1)*" --test 00 100 0101 110011
```

**CLI Output Preview:**
```text
================================================================
  🔍 REGEX PREPROCESSING & PARSING
================================================================
Input Infix Regex:        (a|b)*abb
Explicit Concat Notation: (a|b)*·a·b·b
Postfix (RPN):            ab|*a·b·b·
Alphabet Σ:               { a, b }

================================================================
  ⚡ THOMPSON'S CONSTRUCTION (ε-NFA)
================================================================
Total States:      14
Start State:       q6
Accepting States:  { q13 }

================================================================
  🧩 SUBSET CONSTRUCTION (DFA)
================================================================
Total States:      5
Start State:       A
Accepting States:  { E }

================================================================
  🎯 HOPCROFT'S MINIMIZATION (MINIMIZED DFA)
================================================================
Total States:      4 (reduced from 5)
Start State:       M0
Accepting States:  { M3 }

Minimized DFA Transition Table:
  State | Merged States     | a     | b    
  -----------------------------------------
  -> M0 | {A,C}             | M1    | M0   
  M1    | {B}               | M1    | M2   
  M2    | {D}               | M1    | M3   
  *M3   | {E}               | M1    | M0   
```

---

### Method 3: Automated Verification Tests

Run the comprehensive unit test suite:
```bash
npm test
```
All 76 automated test assertions cover standard TOC languages, edge cases, and empty strings.

---

## 📚 Theory & Mathematical Foundations

### 1. Formal 5-Tuple Definition of a DFA
A Deterministic Finite Automaton $M$ is defined as:
$$M = (Q, \Sigma, \delta, q_0, F)$$
- $Q$: Finite set of states.
- $\Sigma$: Alphabet of input symbols.
- $\delta$: Deterministic transition function $\delta : Q \times \Sigma \to Q$.
- $q_0$: Unique start state ($q_0 \in Q$).
- $F$: Set of accepting/final states ($F \subseteq Q$).

### 2. Supported Regular Expression Syntax
| Operator | Notation | Precedence | Meaning |
| :--- | :---: | :---: | :--- |
| **Kleene Star** | `a*` | Highest (4) | Zero or more occurrences of `a` |
| **Plus** | `a+` | Highest (4) | One or more occurrences of `a` |
| **Optional** | `a?` | Highest (4) | Zero or one occurrence of `a` |
| **Concatenation** | `ab` or `a·b` | Medium (3) | `a` followed by `b` |
| **Alternation / Union**| `a\|b` | Low (2) | `a` or `b` |
| **Groupings** | `(...)` | Highest (Parentheses) | Overrides precedence |
| **Epsilon** | `ε`, `eps`, `@` | Operand | The empty string |

---

## 🔬 Textbook TOC Preset Examples
The application includes preconfigured examples from standard TOC curricula (Hopcroft, Motwani, Ullman / Sipser):

1. **`(a|b)*abb`**: All strings over $\{a, b\}$ ending with `abb`.
2. **`a(b|c)*d`**: Strings starting with `a`, followed by arbitrary `b`'s and `c`'s, ending with `d`.
3. **`(0|1)*00(0|1)*`**: Binary strings containing the substring `00`.
4. **`(a|b)*a(a|b)`**: Strings where the second symbol from the right is `a`.
5. **`(00|11)*`**: Strings composed of repeated even-length blocks of identical digits.
6. **`a+b*`**: At least one `a` followed by zero or more `b`'s.
7. **`(0|1)*1`**: Binary numbers representing odd integers.

---

## 🛠️ Technologies
- **Core Engine**: Pure ECMAScript 6+ modules (zero third-party dependencies).
- **Visualization**: Native Scalable Vector Graphics (SVG) with dynamic curved paths, arrowheads, and glow filters.
- **Runtime**: Node.js & modern web browsers.
