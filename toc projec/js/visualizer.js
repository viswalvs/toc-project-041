/**
 * Interactive SVG Automata Visualizer
 * Renders ε-NFA, DFA, and Minimized DFA with clean draggable states, curved transitions,
 * pill badges for edge labels, self-loops, double concentric circles for accept states,
 * start indicators, zoom, pan, and step animation.
 */

export class AutomataVisualizer {
  constructor(containerElement) {
    this.container = containerElement;
    this.svg = null;
    this.graphGroup = null;
    this.nodes = [];
    this.edges = [];
    this.width = 800;
    this.height = 500;
    this.activeStateId = null;
    this.activeEdgeId = null;

    // Pan & Zoom state
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };

    this.draggedNode = null;
    this.onNodeClickCallback = null;

    this.init();
  }

  init() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.userSelect = 'none';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.cursor = 'grab';

    // SVG Defs for arrowheads and glow filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="27" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="var(--edge-color, #64748b)" />
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="27" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="var(--primary-color, #3b82f6)" />
      </marker>
      <marker id="arrow-start" viewBox="0 0 10 10" refX="27" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="var(--accent-color, #10b981)" />
      </marker>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    `;
    this.svg.appendChild(defs);

    this.graphGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.graphGroup.setAttribute('id', 'graph-group');
    this.svg.appendChild(this.graphGroup);
    this.container.appendChild(this.svg);

    this.setupEvents();
  }

  setupEvents() {
    if (!this.svg) return;

    // Pan controls
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg || e.target === this.graphGroup) {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.svg.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startPan.x;
        this.panY = e.clientY - this.startPan.y;
        this.updateTransform();
      } else if (this.draggedNode) {
        const rect = this.container ? this.container.getBoundingClientRect() : { left: 0, top: 0 };
        const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
        const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;

        this.draggedNode.x = mouseX;
        this.draggedNode.y = mouseY;
        this.renderGraph();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.svg) this.svg.style.cursor = 'grab';
      }
      this.draggedNode = null;
    });

    // Zoom controls via Wheel
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.25), 3.0);

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.updateTransform();
    }, { passive: false });
  }

  updateTransform() {
    if (!this.graphGroup) return;
    this.graphGroup.setAttribute(
      'transform',
      `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`
    );
  }

  resetZoomPan() {
    this.zoom = 1;
    this.panX = 30;
    this.panY = 20;
    this.updateTransform();
  }

  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.2, 3.0);
    this.updateTransform();
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom / 1.2, 0.25);
    this.updateTransform();
  }

  /**
   * Layout algorithm: Horizontal layered dag layout with vertical centering
   */
  computeInitialLayout(nodes, edges) {
    if (!nodes || nodes.length === 0) return;
    const rect = this.container ? this.container.getBoundingClientRect() : { width: 800, height: 450 };
    const width = Math.max(rect.width || 800, 600);
    const height = Math.max(rect.height || 420, 380);

    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Calculate depth from start node
    const depths = new Map();
    const startNode = nodes.find(n => n.isStart) || nodes[0];

    nodes.forEach(n => depths.set(n.id, 0));
    if (startNode) {
      depths.set(startNode.id, 0);
      const queue = [startNode.id];
      const visited = new Set([startNode.id]);

      while (queue.length > 0) {
        const u = queue.shift();
        const currentD = depths.get(u);

        for (const edge of edges) {
          if (edge.from === u && !visited.has(edge.to)) {
            visited.add(edge.to);
            depths.set(edge.to, currentD + 1);
            queue.push(edge.to);
          }
        }
      }
    }

    // Group nodes by depth layers
    const layers = new Map();
    nodes.forEach(node => {
      const d = depths.get(node.id) || 0;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d).push(node);
    });

    const maxDepth = Math.max(...Array.from(layers.keys()), 0);
    const layerSpacingX = Math.min(180, Math.max(130, (width - 180) / (maxDepth + 1 || 1)));

    layers.forEach((layerNodes, d) => {
      const count = layerNodes.length;
      const layerHeight = count * 95;
      const startY = height / 2 - layerHeight / 2 + 45;

      layerNodes.forEach((node, idx) => {
        node.x = 95 + d * layerSpacingX;
        node.y = startY + idx * 95;
      });
    });

    this.zoom = 1;
    this.panX = 25;
    this.panY = 15;
    this.updateTransform();
  }

  loadAutomaton(nodesData, transitionsData) {
    if (!nodesData) return;
    this.nodes = nodesData.map(n => ({
      ...n,
      x: 0,
      y: 0,
      radius: 24 // Increased radius for clear text display
    }));

    // Group multiple transitions between same pair
    const edgeMap = new Map();
    for (const t of (transitionsData || [])) {
      const key = `${t.from}->${t.to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { from: t.from, to: t.to, symbols: [] });
      }
      edgeMap.get(key).symbols.push(t.symbol);
    }

    this.edges = Array.from(edgeMap.values()).map(e => ({
      from: e.from,
      to: e.to,
      label: e.symbols.join(', '),
      isSelfLoop: e.from === e.to
    }));

    this.computeInitialLayout(this.nodes, this.edges);
    this.renderGraph();
  }

  renderGraph() {
    if (!this.graphGroup) return;
    this.graphGroup.innerHTML = '';
    const nodeMap = new Map();
    this.nodes.forEach(n => nodeMap.set(n.id, n));

    // Render Edges
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges-layer');

    for (const edge of this.edges) {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) continue;

      const edgeEl = this.createEdgeElement(source, target, edge);
      edgesGroup.appendChild(edgeEl);
    }
    this.graphGroup.appendChild(edgesGroup);

    // Render Nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes-layer');

    for (const node of this.nodes) {
      const nodeEl = this.createNodeElement(node);
      nodesGroup.appendChild(nodeEl);
    }
    this.graphGroup.appendChild(nodesGroup);
  }

  createEdgeElement(source, target, edge) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'graph-edge');
    const isEdgeActive = this.activeEdgeId === `${edge.from}->${edge.to}`;

    if (edge.isSelfLoop) {
      // Self loop cleanly placed on top of node
      const r = source.radius;
      const x = source.x;
      const y = source.y - r;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const d = `M ${x - 9} ${y} C ${x - 30} ${y - 42}, ${x + 30} ${y - 42}, ${x + 9} ${y}`;
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--edge-color, #64748b)');
      path.setAttribute('stroke-width', isEdgeActive ? '2.5' : '1.8');
      path.setAttribute('marker-end', isEdgeActive ? 'url(#arrow-active)' : 'url(#arrow)');
      group.appendChild(path);

      // Edge Pill Background Badge
      const labelY = y - 44;
      const labelWidth = Math.max(22, edge.label.length * 8 + 14);
      const labelHeight = 18;

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', x - labelWidth / 2);
      bgRect.setAttribute('y', labelY - labelHeight / 2);
      bgRect.setAttribute('width', labelWidth);
      bgRect.setAttribute('height', labelHeight);
      bgRect.setAttribute('rx', '4');
      bgRect.setAttribute('fill', 'var(--bg-secondary, #1e293b)');
      bgRect.setAttribute('stroke', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--border-color, #475569)');
      bgRect.setAttribute('stroke-width', '1');
      group.appendChild(bgRect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', labelY + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--text-main, #f8fafc)');
      text.setAttribute('font-size', '11px');
      text.setAttribute('font-family', 'var(--font-mono)');
      text.setAttribute('font-weight', '700');
      text.textContent = edge.label;
      group.appendChild(text);

      return group;
    }

    const hasReverse = this.edges.some(e => e.from === edge.to && e.to === edge.from);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return group;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let labelX, labelY;

    if (hasReverse) {
      // Curved outward to cleanly separate bidirectional transitions
      const curveOffset = 26;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;

      const nx = -dy / dist;
      const ny = dx / dist;

      const ctrlX = midX + nx * curveOffset;
      const ctrlY = midY + ny * curveOffset;

      path.setAttribute('d', `M ${source.x} ${source.y} Q ${ctrlX} ${ctrlY} ${target.x} ${target.y}`);
      labelX = ctrlX + nx * 4;
      labelY = ctrlY + ny * 4;
    } else if (dx < 0 && Math.abs(dy) < 50) {
      // Backward transition: arch gracefully under the states
      const curveOffset = 38;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2 + curveOffset;

      path.setAttribute('d', `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`);
      labelX = midX;
      labelY = midY + 4;
    } else if (dx > 200 && Math.abs(dy) < 50) {
      // Long forward transition skipping states: arch smoothly over the states
      const curveOffset = -38;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2 + curveOffset;

      path.setAttribute('d', `M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`);
      labelX = midX;
      labelY = midY - 4;
    } else {
      // Clean straight transition
      path.setAttribute('d', `M ${source.x} ${source.y} L ${target.x} ${target.y}`);
      labelX = (source.x + target.x) / 2 - (dy / dist) * 12;
      labelY = (source.y + target.y) / 2 + (dx / dist) * 12;
    }

    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--edge-color, #64748b)');
    path.setAttribute('stroke-width', isEdgeActive ? '2.5' : '1.8');
    path.setAttribute('marker-end', isEdgeActive ? 'url(#arrow-active)' : 'url(#arrow)');
    group.appendChild(path);

    // Pill Badge for transition label
    const labelWidth = Math.max(22, edge.label.length * 8 + 14);
    const labelHeight = 18;

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', labelX - labelWidth / 2);
    bgRect.setAttribute('y', labelY - labelHeight / 2);
    bgRect.setAttribute('width', labelWidth);
    bgRect.setAttribute('height', labelHeight);
    bgRect.setAttribute('rx', '4');
    bgRect.setAttribute('fill', 'var(--bg-secondary, #1e293b)');
    bgRect.setAttribute('stroke', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--border-color, #475569)');
    bgRect.setAttribute('stroke-width', '1');
    group.appendChild(bgRect);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', labelX);
    text.setAttribute('y', labelY + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', isEdgeActive ? 'var(--primary-color, #3b82f6)' : 'var(--text-main, #f8fafc)');
    text.setAttribute('font-size', '11px');
    text.setAttribute('font-family', 'var(--font-mono)');
    text.setAttribute('font-weight', '700');
    text.textContent = edge.label;
    group.appendChild(text);

    return group;
  }

  createNodeElement(node) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'graph-node');
    group.style.cursor = 'grab';

    const isCurrentActive = this.activeStateId === node.id || this.activeStateId === node.name;

    // Start State Arrow & Pill Badge
    if (node.isStart) {
      const arrowStartX = node.x - node.radius - 34;
      const arrowEndX = node.x - node.radius;

      const startArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      startArrow.setAttribute('d', `M ${arrowStartX} ${node.y} L ${arrowEndX} ${node.y}`);
      startArrow.setAttribute('stroke', 'var(--accent-color, #10b981)');
      startArrow.setAttribute('stroke-width', '2.5');
      startArrow.setAttribute('marker-end', 'url(#arrow-start)');
      group.appendChild(startArrow);

      // Start Tag Pill
      const tagWidth = 38;
      const tagHeight = 16;
      const tagRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      tagRect.setAttribute('x', arrowStartX - tagWidth);
      tagRect.setAttribute('y', node.y - tagHeight / 2);
      tagRect.setAttribute('width', tagWidth);
      tagRect.setAttribute('height', tagHeight);
      tagRect.setAttribute('rx', '3');
      tagRect.setAttribute('fill', 'rgba(16, 185, 129, 0.15)');
      tagRect.setAttribute('stroke', 'var(--accent-color, #10b981)');
      tagRect.setAttribute('stroke-width', '1');
      group.appendChild(tagRect);

      const startText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      startText.setAttribute('x', arrowStartX - tagWidth / 2);
      startText.setAttribute('y', node.y + 3.5);
      startText.setAttribute('text-anchor', 'middle');
      startText.setAttribute('fill', 'var(--accent-color, #10b981)');
      startText.setAttribute('font-size', '9px');
      startText.setAttribute('font-weight', '800');
      startText.setAttribute('letter-spacing', '0.05em');
      startText.textContent = 'START';
      group.appendChild(startText);
    }

    // Outer circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', node.x);
    circle.setAttribute('cy', node.y);
    circle.setAttribute('r', node.radius);
    circle.setAttribute('fill', isCurrentActive ? 'var(--state-active-bg, #1e3a8a)' : 'var(--state-bg, #1e293b)');
    circle.setAttribute('stroke', isCurrentActive ? 'var(--primary-color, #3b82f6)' : 'var(--state-border, #94a3b8)');
    circle.setAttribute('stroke-width', isCurrentActive ? '3' : '2');
    if (isCurrentActive) {
      circle.setAttribute('filter', 'url(#glow)');
    }
    group.appendChild(circle);

    // Double circle for Final / Accept States
    if (node.isAccept) {
      const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      innerCircle.setAttribute('cx', node.x);
      innerCircle.setAttribute('cy', node.y);
      innerCircle.setAttribute('r', node.radius - 4.5);
      innerCircle.setAttribute('fill', 'none');
      innerCircle.setAttribute('stroke', isCurrentActive ? 'var(--primary-color, #3b82f6)' : 'var(--warning-color, #f59e0b)');
      innerCircle.setAttribute('stroke-width', '1.6');
      group.appendChild(innerCircle);
    }

    // State Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x);
    text.setAttribute('y', node.y + 4.5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', 'var(--text-main, #f8fafc)');
    text.setAttribute('font-size', '13px');
    text.setAttribute('font-family', 'var(--font-mono)');
    text.setAttribute('font-weight', '700');
    text.textContent = node.name || `q${node.id}`;
    group.appendChild(text);

    // Node drag listeners
    group.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.draggedNode = node;
      group.style.cursor = 'grabbing';
      if (this.onNodeClickCallback) {
        this.onNodeClickCallback(node);
      }
    });

    return group;
  }

  highlightState(stateId, fromStateId = null) {
    this.activeStateId = stateId;
    if (fromStateId !== null && stateId !== null) {
      this.activeEdgeId = `${fromStateId}->${stateId}`;
    } else {
      this.activeEdgeId = null;
    }
    this.renderGraph();
  }

  clearHighlight() {
    this.activeStateId = null;
    this.activeEdgeId = null;
    this.renderGraph();
  }

  onNodeClick(callback) {
    this.onNodeClickCallback = callback;
  }

  exportSVG() {
    if (!this.svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(this.svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'automaton_graph.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}
