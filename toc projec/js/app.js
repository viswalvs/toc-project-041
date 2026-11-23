/**
 * Application Main Controller
 * Coordinates parsing, automata generation, interactive visualization,
 * string simulation, table rendering, view toggles, and user interactions.
 */

import { parseRegex, EPSILON } from './regex-parser.js';
import { buildNFAFromPostfix } from './nfa.js';
import { buildDFAFromNFA } from './dfa.js';
import { minimizeDFA } from './minimizer.js';
import { AutomataVisualizer } from './visualizer.js';
import { simulateDFA } from './simulator.js';

class TOCApp {
  constructor() {
    this.currentData = {
      parsed: null,
      nfa: null,
      dfa: null,
      minDFA: null
    };

    this.visualizers = {
      minDFA: null,
      dfa: null,
      nfa: null
    };

    this.activeTab = 'tab-min-dfa';
    this.simTrace = null;
    this.simStepIndex = 0;

    this.initVisualizers();
    this.bindEvents();
    this.runConversion();
  }

  el(id) {
    return document.getElementById(id);
  }

  setText(id, text) {
    const element = this.el(id);
    if (element) {
      element.textContent = text;
    }
  }

  initVisualizers() {
    const minContainer = this.el('graph-container-min-dfa');
    const dfaContainer = this.el('graph-container-dfa');
    const nfaContainer = this.el('graph-container-nfa');

    if (minContainer) this.visualizers.minDFA = new AutomataVisualizer(minContainer);
    if (dfaContainer) this.visualizers.dfa = new AutomataVisualizer(dfaContainer);
    if (nfaContainer) this.visualizers.nfa = new AutomataVisualizer(nfaContainer);
  }

  bindEvents() {
    // Theme toggle
    const themeBtn = this.el('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        try {
          localStorage.setItem('toc-theme', newTheme);
        } catch (_) {}
        this.refreshCurrentVisualizer();
      });
      try {
        const savedTheme = localStorage.getItem('toc-theme');
        if (savedTheme) {
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      } catch (_) {}
    }

    // Convert button
    this.el('convert-btn')?.addEventListener('click', () => this.runConversion());

    // Enter key in regex input
    const regexInput = this.el('regex-input');
    if (regexInput) {
      regexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.runConversion();
      });
    }

    // Presets dropdown
    const presetSelect = this.el('preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        if (e.target.value && regexInput) {
          regexInput.value = e.target.value;
          this.setSuggestedString(e.target.value);
          this.runConversion();
        }
      });
    }

    // Operator buttons
    document.querySelectorAll('.op-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.getAttribute('data-insert');
        if (symbol) this.insertSymbolAtCursor(symbol);
      });
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        if (tabId) this.switchTab(tabId);
      });
    });

    // View Mode buttons (Split / Diagram Only / Table Only)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = btn.getAttribute('data-target');
        const mode = btn.getAttribute('data-mode');
        const section = this.el(targetId);
        if (!section) return;

        section.classList.remove('mode-diagram-only', 'mode-table-only');
        if (mode === 'diagram') section.classList.add('mode-diagram-only');
        else if (mode === 'table') section.classList.add('mode-table-only');

        // Toggle active button in group
        const group = btn.closest('.view-mode-bar');
        if (group) {
          group.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }

        // Refresh graph layout
        setTimeout(() => this.refreshCurrentVisualizer(), 50);
      });
    });

    // Zoom buttons
    this.el('zoom-in-min')?.addEventListener('click', () => this.visualizers.minDFA?.zoomIn());
    this.el('zoom-out-min')?.addEventListener('click', () => this.visualizers.minDFA?.zoomOut());
    this.el('zoom-reset-min')?.addEventListener('click', () => this.visualizers.minDFA?.resetZoomPan());

    this.el('zoom-in-dfa')?.addEventListener('click', () => this.visualizers.dfa?.zoomIn());
    this.el('zoom-out-dfa')?.addEventListener('click', () => this.visualizers.dfa?.zoomOut());
    this.el('zoom-reset-dfa')?.addEventListener('click', () => this.visualizers.dfa?.resetZoomPan());

    this.el('zoom-in-nfa')?.addEventListener('click', () => this.visualizers.nfa?.zoomIn());
    this.el('zoom-out-nfa')?.addEventListener('click', () => this.visualizers.nfa?.zoomOut());
    this.el('zoom-reset-nfa')?.addEventListener('click', () => this.visualizers.nfa?.resetZoomPan());

    // Simulator buttons
    this.el('sim-test-btn')?.addEventListener('click', () => this.runSingleSimulation());
    this.el('sim-step-btn')?.addEventListener('click', () => this.startStepSimulation());
    this.el('sim-reset-btn')?.addEventListener('click', () => this.resetSimulation());

    // Batch Tester
    this.el('batch-run-btn')?.addEventListener('click', () => this.runBatchTests());

    // Mobile QR Modal
    const mobileBtn = this.el('mobile-qr-btn');
    const mobileModal = this.el('mobile-modal');
    const closeModalBtn = this.el('close-modal-btn');
    const copyMobileBtn = this.el('copy-mobile-url-btn');

    if (mobileBtn && mobileModal) {
      mobileBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/ip');
          if (res.ok) {
            const data = await res.json();
            const host = data.ip || window.location.hostname;
            const port = data.port || window.location.port || '5000';
            const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
            const url = `${protocol}//${host}${port ? `:${port}` : ''}`;
            const input = this.el('mobile-url-input');
            const img = this.el('mobile-qr-img');
            if (input) input.value = url;
            if (img) img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
          }
        } catch (_) {
          // Static hosting or API failure: use the current page URL as a safe fallback.
          const input = this.el('mobile-url-input');
          const img = this.el('mobile-qr-img');
          const url = window.location.origin;
          if (input) input.value = url;
          if (img) img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
        }
        mobileModal.style.display = 'flex';
      });

      closeModalBtn?.addEventListener('click', () => {
        mobileModal.style.display = 'none';
      });

      mobileModal.addEventListener('click', (e) => {
        if (e.target === mobileModal) mobileModal.style.display = 'none';
      });

      copyMobileBtn?.addEventListener('click', () => {
        const input = this.el('mobile-url-input');
        if (input && navigator.clipboard) {
          navigator.clipboard.writeText(input.value).then(() => {
            alert('Mobile link copied to clipboard!');
          }).catch(() => prompt('Copy mobile link below:', input.value));
        } else if (input) {
          prompt('Copy mobile link below:', input.value);
        }
      });
    }

    // Exports
    this.el('export-svg-btn')?.addEventListener('click', () => this.exportCurrentSVG());
    this.el('export-latex-btn')?.addEventListener('click', () => this.exportLaTeX());
    this.el('export-markdown-btn')?.addEventListener('click', () => this.exportMarkdown());

    // Table Copy Buttons
    document.querySelectorAll('.copy-min-table-btn').forEach(b => b.addEventListener('click', () => this.copySpecificTable('min')));
    document.querySelectorAll('.copy-dfa-table-btn').forEach(b => b.addEventListener('click', () => this.copySpecificTable('dfa')));
    document.querySelectorAll('.copy-nfa-table-btn').forEach(b => b.addEventListener('click', () => this.copySpecificTable('nfa')));
  }

  insertSymbolAtCursor(symbol) {
    const input = this.el('regex-input');
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value || '';
    input.value = val.substring(0, start) + symbol + val.substring(end);
    input.focus();
    input.setSelectionRange(start + symbol.length, start + symbol.length);
  }

  setSuggestedString(regex) {
    const simInput = this.el('test-string-input');
    if (!simInput) return;
    if (regex.includes('abb')) simInput.value = 'abb';
    else if (regex.includes('00')) simInput.value = '1001';
    else if (regex.includes('11')) simInput.value = '0011';
    else if (regex.startsWith('a(')) simInput.value = 'ad';
    else simInput.value = 'a';
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.toggle('active', section.id === tabId);
    });

    setTimeout(() => {
      this.refreshCurrentVisualizer();
    }, 50);
  }

  refreshCurrentVisualizer() {
    if (this.activeTab === 'tab-min-dfa' && this.visualizers.minDFA) {
      this.visualizers.minDFA.renderGraph();
    } else if (this.activeTab === 'tab-dfa' && this.visualizers.dfa) {
      this.visualizers.dfa.renderGraph();
    } else if (this.activeTab === 'tab-nfa' && this.visualizers.nfa) {
      this.visualizers.nfa.renderGraph();
    }
  }

  runConversion() {
    const regexInput = this.el('regex-input');
    const rawRegex = regexInput ? regexInput.value.trim() : '(a|b)*abb';
    const unionCheck = this.el('plus-union-check');
    const unionPlus = unionCheck ? unionCheck.checked : false;

    if (!rawRegex) {
      alert('Please enter a regular expression!');
      return;
    }

    try {
      // 1. Parsing & Postfix
      const parsed = parseRegex(rawRegex, { unionPlus });
      this.currentData.parsed = parsed;

      // 2. Thompson's ε-NFA
      const nfa = buildNFAFromPostfix(parsed.tokens, parsed.alphabet);
      this.currentData.nfa = nfa;

      // 3. Subset Construction DFA
      const dfa = buildDFAFromNFA(nfa, parsed.alphabet);
      this.currentData.dfa = dfa;

      // 4. Hopcroft Minimization
      const minDFA = minimizeDFA(dfa);
      this.currentData.minDFA = minDFA;

      // Update UI
      this.updateStats();
      this.renderVisualizers();
      this.renderTransitionTables();
      this.renderStepByStepLogs();
      this.resetSimulation();

    } catch (err) {
      alert(`Error processing regular expression:\n${err.message}`);
      console.error(err);
    }
  }

  updateStats() {
    const { parsed, nfa, dfa, minDFA } = this.currentData;
    if (!parsed || !nfa || !dfa || !minDFA) return;

    this.setText('alphabet-badge', `Σ = { ${parsed.alphabet.join(', ')} }`);
    this.setText('stat-nfa-states', nfa.states.size);
    this.setText('stat-dfa-states', dfa.states.length);
    this.setText('stat-min-states', minDFA.states.length);

    this.setText('badge-min-dfa', `${minDFA.states.length} States`);
    this.setText('badge-dfa', `${dfa.states.length} States`);
    this.setText('badge-nfa', `${nfa.states.size} States`);

    const minAccept = Array.from(minDFA.acceptStates).map(s => s.name).join(', ') || 'none';
    this.setText(
      'min-dfa-status-text',
      `States: ${minDFA.states.length} | Start: ${minDFA.startState?.name || '—'} | Accept: { ${minAccept} }`
    );

    const dfaAccept = Array.from(dfa.acceptStates).map(s => s.name).join(', ') || 'none';
    this.setText(
      'dfa-status-text',
      `States: ${dfa.states.length} | Start: ${dfa.startState?.name || '—'} | Accept: { ${dfaAccept} }`
    );

    const nfaAccept = Array.from(nfa.acceptStates).map(s => `q${s}`).join(', ') || 'none';
    this.setText(
      'nfa-status-text',
      `States: ${nfa.states.size} | Start: q${nfa.startState} | Accept: { ${nfaAccept} }`
    );
  }

  renderVisualizers() {
    const { nfa, dfa, minDFA } = this.currentData;
    if (!nfa || !dfa || !minDFA) return;

    // 1. Minimized DFA
    if (this.visualizers.minDFA) {
      const nodes = minDFA.states.map(s => ({
        id: s.id,
        name: s.name,
        isStart: s.isStart,
        isAccept: s.isAccept
      }));
      const transitions = minDFA.getTransitionsList();
      this.visualizers.minDFA.loadAutomaton(nodes, transitions);
    }

    // 2. DFA
    if (this.visualizers.dfa) {
      const nodes = dfa.states.map(s => ({
        id: s.id,
        name: s.name,
        isStart: s.isStart,
        isAccept: s.isAccept
      }));
      const transitions = dfa.getTransitionsList();
      this.visualizers.dfa.loadAutomaton(nodes, transitions);
    }

    // 3. ε-NFA
    if (this.visualizers.nfa) {
      const nodes = Array.from(nfa.states.keys()).map(id => ({
        id,
        name: `q${id}`,
        isStart: id === nfa.startState,
        isAccept: nfa.acceptStates.has(id)
      }));
      const transitions = nfa.getTransitionsList();
      this.visualizers.nfa.loadAutomaton(nodes, transitions);
    }
  }

  renderTransitionTables() {
    const { nfa, dfa, minDFA, parsed } = this.currentData;
    if (!nfa || !dfa || !minDFA || !parsed) return;

    // Minimized DFA Table
    const minTableData = minDFA.getTransitionTable();
    this.renderGenericTable(
      this.el('min-dfa-table-container'),
      minTableData.headers,
      minTableData.rows,
      parsed.alphabet,
      'min'
    );
    this.renderGenericTable(
      this.el('compare-min-table-container'),
      minTableData.headers,
      minTableData.rows,
      parsed.alphabet,
      'compare-min'
    );

    // DFA Table
    const dfaTableData = dfa.getTransitionTable();
    this.renderGenericTable(
      this.el('dfa-table-container'),
      dfaTableData.headers,
      dfaTableData.rows,
      parsed.alphabet,
      'dfa'
    );
    this.renderGenericTable(
      this.el('compare-dfa-table-container'),
      dfaTableData.headers,
      dfaTableData.rows,
      parsed.alphabet,
      'compare-dfa'
    );

    // ε-NFA Table
    const nfaTableData = nfa.getTransitionTable(parsed.alphabet);
    this.renderGenericTable(
      this.el('nfa-table-container'),
      nfaTableData.headers,
      nfaTableData.rows,
      [...parsed.alphabet, EPSILON],
      'nfa'
    );
    this.renderGenericTable(
      this.el('compare-nfa-table-container'),
      nfaTableData.headers,
      nfaTableData.rows,
      [...parsed.alphabet, EPSILON],
      'compare-nfa'
    );
  }

  renderGenericTable(container, headers, rows, alphabet, type) {
    if (!container || !headers || !rows) return;

    let html = `<div class="table-wrapper"><table class="data-table" id="table-${type}"><thead><tr>`;
    for (const h of headers) {
      html += `<th>${h}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (const row of rows) {
      html += `<tr data-state="${row.name || row.stateId}">`;

      // Clean state column with badges
      let badgeHtml = '';
      if (row.isStart && row.isAccept) {
        badgeHtml = `<span class="badge-both">▶ START ★ FINAL</span>`;
      } else if (row.isStart) {
        badgeHtml = `<span class="badge-start">▶ START</span>`;
      } else if (row.isAccept) {
        badgeHtml = `<span class="badge-accept">★ FINAL</span>`;
      } else {
        badgeHtml = `<span class="badge-normal"></span>`;
      }

      const stateName = row.name || `q${row.stateId}`;
      html += `<td>
        <div class="state-cell-container">
          ${badgeHtml}
          <span class="state-pill state-pill-main">${stateName}</span>
        </div>
      </td>`;

      if (row.originalGroup) {
        html += `<td><span class="subset-badge">${row.originalGroup}</span></td>`;
      }
      if (row.nfaSubset) {
        html += `<td><span class="subset-badge">${row.nfaSubset}</span></td>`;
      }

      // Transition columns
      for (const symbol of alphabet) {
        const val = row.cells ? row.cells[symbol] : '—';
        if (!val || val === '—' || val === '∅') {
          html += `<td style="text-align: center;"><span class="empty-symbol">∅</span></td>`;
        } else if (val.startsWith('{')) {
          // Multiple states in NFA: e.g. {q1, q2}
          const inner = val.replace(/[{}]/g, '').split(',').map(s => s.trim()).filter(Boolean);
          const pills = inner.map(s => `<span class="state-pill">${s}</span>`).join(' ');
          html += `<td style="text-align: center;">{ ${pills} }</td>`;
        } else {
          html += `<td style="text-align: center;"><span class="state-pill">${val}</span></td>`;
        }
      }
      html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  renderStepByStepLogs() {
    const { parsed, dfa, minDFA } = this.currentData;
    if (!parsed || !dfa || !minDFA) return;

    // Stage 1: Postfix
    this.setText('step-raw-regex', parsed.raw);
    this.setText('step-concat-regex', parsed.withConcat);
    this.setText('step-postfix-regex', parsed.postfix);

    // Stage 2: Subset Construction Table
    const subsetContainer = this.el('steps-subset-table-container');
    if (subsetContainer && dfa.subsetSteps) {
      let html = `<table class="data-table"><thead><tr>
        <th>DFA State</th>
        <th>NFA Subset</th>
        <th>Is Final?</th>`;

      for (const sym of parsed.alphabet) {
        html += `<th style="text-align: center;">move(S, '${sym}')</th><th style="text-align: center;">ε-closure → Next</th>`;
      }
      html += `</tr></thead><tbody>`;

      for (const step of dfa.subsetSteps) {
        html += `<tr>
          <td><span class="state-pill state-pill-main">${step.stateName}</span></td>
          <td><span class="subset-badge">${step.nfaSubset}</span></td>
          <td>${step.isAccept ? '<span class="badge-accept">★ Yes</span>' : '<span style="color: var(--text-muted);">No</span>'}</td>`;

        for (const sym of parsed.alphabet) {
          const t = step.transitions ? step.transitions[sym] : null;
          if (t && t.targetName !== '—') {
            html += `<td style="text-align: center;"><span class="subset-badge">${t.move}</span></td>
                     <td style="text-align: center;"><strong><span class="state-pill">${t.targetName}</span></strong> <span class="subset-badge">${t.closure}</span></td>`;
          } else {
            html += `<td style="text-align: center;"><span class="empty-symbol">∅</span></td><td style="text-align: center;"><span class="empty-symbol">∅</span></td>`;
          }
        }
        html += `</tr>`;
      }
      html += `</tbody></table>`;
      subsetContainer.innerHTML = html;
    }

    // Stage 3: Hopcroft Minimization Partition Log
    const minStepsContainer = this.el('steps-minimization-container');
    if (minStepsContainer && minDFA.partitionHistory) {
      let html = '';
      for (const h of minDFA.partitionHistory) {
        html += `
          <div style="background-color: var(--bg-secondary); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-family: var(--font-mono);">
            <div style="color: var(--primary-color); font-weight: bold; margin-bottom: 4px; font-size: 0.85rem;">
              ${h.description}
            </div>
            <div style="font-size: 0.95rem; color: var(--text-main);">
              <strong>P = [ ${h.groups.join(', ')} ]</strong>
            </div>
          </div>
        `;
      }
      minStepsContainer.innerHTML = html;
    }
  }

  /**
   * String Simulator
   */
  runSingleSimulation() {
    const input = this.el('test-string-input');
    const str = input ? input.value.trim() : '';
    const { minDFA } = this.currentData;
    if (!minDFA) return;

    const result = simulateDFA(minDFA, str);
    this.displayVerdict(result);

    if (result.finalState && result.finalState !== 'TRAP') {
      this.visualizers.minDFA?.highlightState(result.finalState);
    }
  }

  displayVerdict(result) {
    const container = this.el('sim-verdict-container');
    if (!container || !result) return;

    const cls = result.accepted ? 'verdict-accepted' : 'verdict-rejected';
    const icon = result.accepted ? '✅ ACCEPTED' : '❌ REJECTED';

    container.innerHTML = `
      <div class="verdict-box ${cls}">
        <div>
          <div style="font-size: 0.95rem; font-weight: bold;">${icon}</div>
          <div style="font-size: 0.82rem; font-weight: normal; margin-top: 2px;">${result.reason}</div>
        </div>
      </div>
    `;
  }

  startStepSimulation() {
    const input = this.el('test-string-input');
    const str = input ? input.value.trim() : '';
    const { minDFA } = this.currentData;
    if (!minDFA) return;

    this.simTrace = simulateDFA(minDFA, str);
    this.simStepIndex = 0;

    const stepperContainer = this.el('sim-stepper-container');
    if (stepperContainer) {
      stepperContainer.innerHTML = `
        <div class="trace-stepper">
          <button id="step-prev-btn" class="btn btn-secondary btn-sm" disabled>⏮ Prev</button>
          <button id="step-next-btn" class="btn btn-primary btn-sm">Next ⏭</button>
          <span id="step-info" style="font-size: 0.8rem; font-weight: 600; flex: 1; text-align: center;"></span>
        </div>
      `;

      this.el('step-prev-btn')?.addEventListener('click', () => this.applyStep(-1));
      this.el('step-next-btn')?.addEventListener('click', () => this.applyStep(1));
    }

    const verdictContainer = this.el('sim-verdict-container');
    if (verdictContainer) verdictContainer.innerHTML = '';

    this.renderCurrentStep();
  }

  applyStep(direction) {
    if (!this.simTrace || !this.simTrace.trace) return;
    this.simStepIndex += direction;
    this.simStepIndex = Math.max(0, Math.min(this.simStepIndex, this.simTrace.trace.length - 1));
    this.renderCurrentStep();
  }

  renderCurrentStep() {
    if (!this.simTrace || !this.simTrace.trace) return;
    const item = this.simTrace.trace[this.simStepIndex];
    if (!item) return;
    const total = this.simTrace.trace.length - 1;

    const infoEl = this.el('step-info');
    if (infoEl) {
      infoEl.textContent = `Step ${this.simStepIndex} of ${total}: ${item.action}`;
    }

    const prevBtn = this.el('step-prev-btn');
    if (prevBtn) prevBtn.disabled = this.simStepIndex === 0;

    const nextBtn = this.el('step-next-btn');
    if (nextBtn) nextBtn.disabled = this.simStepIndex === total;

    // Highlight state on graph
    if (item.currentState && item.currentState !== 'TRAP / DEAD') {
      this.visualizers.minDFA?.highlightState(item.currentState, item.fromState);
    } else {
      this.visualizers.minDFA?.clearHighlight();
    }

    // Highlight row in table
    document.querySelectorAll('#table-min tr').forEach(tr => tr.classList.remove('active-state-row'));
    const targetRow = document.querySelector(`#table-min tr[data-state="${item.currentState}"]`);
    if (targetRow) targetRow.classList.add('active-state-row');

    if (this.simStepIndex === total) {
      this.displayVerdict(this.simTrace);
    }
  }

  resetSimulation() {
    this.simTrace = null;
    this.simStepIndex = 0;
    const stepperContainer = this.el('sim-stepper-container');
    if (stepperContainer) stepperContainer.innerHTML = '';
    const verdictContainer = this.el('sim-verdict-container');
    if (verdictContainer) verdictContainer.innerHTML = '';
    this.visualizers.minDFA?.clearHighlight();
    document.querySelectorAll('tr').forEach(tr => tr.classList.remove('active-state-row'));
  }

  /**
   * Batch Tests
   */
  runBatchTests() {
    const area = this.el('batch-input-area');
    const raw = area ? area.value : '';
    const strings = raw.split(/[\n,]/).map(s => s.trim()).filter(s => s.length >= 0 && s !== '');
    const { minDFA } = this.currentData;
    const tbody = this.el('batch-results-body');
    if (!tbody || !minDFA) return;

    if (strings.length === 0) {
      strings.push('ε');
    }

    let html = '';
    for (const s of strings) {
      const testStr = s === 'ε' || s === "''" || s === '""' ? '' : s;
      const res = simulateDFA(minDFA, testStr);

      const badge = res.accepted
        ? `<span style="background: rgba(16, 185, 129, 0.2); color: var(--accent-color); padding: 2px 8px; border-radius: 4px; font-weight: bold;">ACCEPTED</span>`
        : `<span style="background: rgba(239, 68, 68, 0.2); color: var(--danger-color); padding: 2px 8px; border-radius: 4px; font-weight: bold;">REJECTED</span>`;

      const pathStr = res.trace.map(t => t.currentState).join(' → ');

      html += `<tr>
        <td><code>${s === '' ? 'ε' : s}</code></td>
        <td>${testStr.length}</td>
        <td>${badge}</td>
        <td><strong>${res.finalState}</strong></td>
        <td><small style="color: var(--text-muted);">${pathStr}</small></td>
      </tr>`;
    }
    tbody.innerHTML = html;
  }

  copySpecificTable(type) {
    let tableData = null;
    let title = '';

    if (type === 'min') {
      tableData = this.currentData.minDFA?.getTransitionTable();
      title = 'Minimized DFA Transition Table';
    } else if (type === 'dfa') {
      tableData = this.currentData.dfa?.getTransitionTable();
      title = 'DFA Transition Table (Subset Construction)';
    } else if (type === 'nfa') {
      tableData = this.currentData.nfa?.getTransitionTable(this.currentData.parsed?.alphabet);
      title = 'ε-NFA Transition Table (Thompson)';
    }

    if (!tableData) return;

    let md = `### ${title}\n\n`;
    md += `| ${tableData.headers.join(' | ')} |\n`;
    md += `| ${tableData.headers.map(() => ':---:').join(' | ')} |\n`;

    for (const row of tableData.rows) {
      const cols = [row.label];
      if (row.originalGroup) cols.push(row.originalGroup);
      if (row.nfaSubset) cols.push(row.nfaSubset);
      for (const symbol of (tableData.alphabet || [])) {
        cols.push(row.cells ? (row.cells[symbol] || '—') : '—');
      }
      md += `| ${cols.join(' | ')} |\n`;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(md).then(() => {
        alert(`${title} copied to clipboard as Markdown!`);
      }).catch(() => prompt('Copy Markdown table below:', md));
    } else {
      prompt('Copy Markdown table below:', md);
    }
  }

  exportCurrentSVG() {
    let viz = this.visualizers.minDFA;
    if (this.activeTab === 'tab-dfa') viz = this.visualizers.dfa;
    if (this.activeTab === 'tab-nfa') viz = this.visualizers.nfa;
    viz?.exportSVG();
  }

  exportLaTeX() {
    const { minDFA } = this.currentData;
    if (!minDFA) return;
    const tableData = minDFA.getTransitionTable();
    let latex = `% LaTeX Transition Table for Minimized DFA\n\\begin{table}[h]\n\\centering\n\\begin{tabular}{|l|l|${tableData.alphabet.map(() => 'c|').join('')}}\n\\hline\n`;
    latex += `State & Merged Set & ${tableData.alphabet.map(a => `$${a}$`).join(' & ')} \\\\\n\\hline\n`;

    for (const row of tableData.rows) {
      const cleanLabel = row.label.replace('->', '$\\to$').replace('*', '$*$');
      const cells = tableData.alphabet.map(a => (row.cells ? row.cells[a] : '--') || '--').join(' & ');
      const orig = row.originalGroup ? row.originalGroup.replace(/[{}]/g, '') : '';
      latex += `${cleanLabel} & \\{${orig}\\} & ${cells} \\\\\n`;
    }

    latex += `\\hline\n\\end{tabular}\n\\caption{Transition table of the Minimized DFA}\n\\end{table}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(latex).then(() => {
        alert('LaTeX Transition Table copied to clipboard!');
      }).catch(() => prompt('Copy LaTeX code below:', latex));
    } else {
      prompt('Copy LaTeX code below:', latex);
    }
  }

  exportMarkdown() {
    this.copySpecificTable('min');
  }
}

// Safely instantiate when DOM is ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    new TOCApp();
  });
} else {
  new TOCApp();
}
