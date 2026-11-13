(() => {
  'use strict';

  const data = JSON.parse(document.getElementById('graph-data').textContent);
  const $ = id => document.getElementById(id);
  const svg = $('graph');
  const viewport = $('viewport');
  const tooltip = $('tooltip');
  const search = $('search');
  const themeQuery = matchMedia('(prefers-color-scheme: dark)');
  let savedTheme;
  try { savedTheme = localStorage.getItem('purrject-theme'); } catch { /* Local files may deny storage. */ }
  let explicitTheme = savedTheme === 'light' || savedTheme === 'dark';

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    $('theme-toggle').setAttribute('aria-label', label);
    $('theme-toggle').title = label;
  }
  setTheme(explicitTheme ? savedTheme : themeQuery.matches ? 'dark' : 'light');
  $('theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    explicitTheme = true;
    setTheme(theme);
    try { localStorage.setItem('purrject-theme', theme); } catch { /* Theme still works without storage. */ }
  });
  themeQuery.addEventListener('change', event => {
    if (!explicitTheme) setTheme(event.matches ? 'dark' : 'light');
  });

  document.title = `${data.name} · Dependency map`;
  $('project-name').textContent = data.name;
  $('project-name').title = data.name;
  $('module-count').textContent = data.nodes.length;
  $('edge-count').textContent = data.edges.length;
  $('empty-state').hidden = data.nodes.length > 0;

  const nodes = data.nodes.map((node, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const distance = 80 * Math.sqrt(index);
    return { ...node, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance,
      vx: 0, vy: 0, incoming: new Set(), outgoing: new Set() };
  });
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const edges = data.edges.map(edge => ({ ...edge, source: nodeById.get(edge.from), target: nodeById.get(edge.to) }));
  for (const edge of edges) {
    edge.source.outgoing.add(edge.to);
    edge.target.incoming.add(edge.from);
  }
  const maxIncoming = Math.max(1, ...nodes.map(node => node.incoming.size));
  const camera = { x: 0, y: 0, scale: 1 };
  let selectedId = null;
  let query = '';
  let gesture = null;
  let layoutFrame = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elasticMotion = null;
  let elasticFrame = 0;
  svg.dataset.motion = 'idle';

  function svgElement(tag, attributes = {}, text) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  for (const edge of edges) {
    edge.element = svgElement('path', { class: 'edge', 'data-from': edge.from, 'data-to': edge.to });
    edge.element.append(svgElement('title', {}, `${edge.from} → ${edge.to}`));
    edge.flow = svgElement('path', { class: 'edge-flow', 'aria-hidden': 'true' });
    $('edges').append(edge.element, edge.flow);
  }

  for (const node of nodes) {
    // Incoming degree counts distinct modules, not repeated requirements.
    node.radius = 19 + 22 * Math.sqrt(node.incoming.size / maxIncoming);
    const group = svgElement('g', { class: 'node', tabindex: '0', role: 'button',
      'aria-label': `${node.id}: ${node.outgoing.size} dependencies, ${node.incoming.size} dependents`,
      'aria-pressed': 'false', 'data-id': node.id });
    const visual = svgElement('g', { class: 'node-visual', 'aria-hidden': 'true' });
    visual.append(svgElement('circle', { class: 'node-ring', r: node.radius + 5 }));
    visual.append(svgElement('circle', { class: 'node-body', r: node.radius }));
    visual.append(svgElement('path', { class: 'node-mark', d: 'M-7-4 0-8 7-4v8L0 8-7 4Z M-7-4 0 0 7-4 M0 0v8' }));
    group.append(visual);
    const label = svgElement('text', { y: node.radius + 20 }, node.id);
    group.append(label);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectNode(node.id);
      }
    });
    group.addEventListener('dblclick', () => {
      if (node.document) window.open(node.document, '_blank', 'noopener,noreferrer');
    });
    group.addEventListener('pointerenter', event => showTooltip(node, event));
    group.addEventListener('pointermove', event => {
      if (!gesture) showTooltip(node, event);
    });
    group.addEventListener('pointerleave', hideTooltip);
    group.addEventListener('focus', () => {
      if (group.matches(':focus-visible')) revealNode(node);
    });
    node.element = group;
    $('nodes').append(group);
    node.labelWidth = label.getComputedTextLength();
  }

  function edgePath(edge) {
    const a = edge.source;
    const b = edge.target;
    if (a === b) {
      const r = a.radius;
      const end = (r + 6) * Math.SQRT1_2;
      return `M${a.x + end},${a.y - end} C${a.x + r * 2.8},${a.y - r * 3.4} ${a.x - r * 2.8},${a.y - r * 3.4} ${a.x - end},${a.y - end}`;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || 1;
    // Reciprocal dependencies take separate curved paths, each with one arrow.
    const bend = b.outgoing.has(a.id) ? 34 : 0;
    const cx = (a.x + b.x) / 2 - dy / distance * bend;
    const cy = (a.y + b.y) / 2 + dx / distance * bend;
    const startLength = Math.hypot(cx - a.x, cy - a.y) || 1;
    const endLength = Math.hypot(b.x - cx, b.y - cy) || 1;
    const startRadius = Math.min(a.radius + 4, distance * .4);
    const endRadius = Math.min(b.radius + 5, distance * .4);
    const sx = a.x + (cx - a.x) / startLength * startRadius;
    const sy = a.y + (cy - a.y) / startLength * startRadius;
    const tx = b.x - (b.x - cx) / endLength * endRadius;
    const ty = b.y - (b.y - cy) / endLength * endRadius;
    return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
  }

  function renderPositions() {
    for (const node of nodes) node.element.setAttribute('transform', `translate(${node.x},${node.y})`);
    for (const edge of edges) {
      const path = edgePath(edge);
      edge.element.setAttribute('d', path);
      edge.flow.setAttribute('d', path);
    }
  }

  function renderCamera() {
    viewport.setAttribute('transform', `translate(${camera.x},${camera.y}) scale(${camera.scale})`);
    $('zoom-level').textContent = `${Math.round(camera.scale * 100)}%`;
  }

  function graphArea() {
    const { width, height } = svg.getBoundingClientRect();
    const top = Math.max(180, document.querySelector('.map-heading').offsetTop + document.querySelector('.map-heading').offsetHeight + 30);
    return { width, height, top, bottom: 110, padding: width < 500 ? 30 : 55 };
  }

  function fitView() {
    const { width, height, top, bottom, padding } = graphArea();
    if (!width || !height) return;
    if (!nodes.length) {
      camera.x = width / 2;
      camera.y = height / 2;
      camera.scale = 1;
    } else {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const node of nodes) {
        const halfWidth = Math.max(node.radius + 10, node.labelWidth / 2 + 6);
        minX = Math.min(minX, node.x - halfWidth);
        maxX = Math.max(maxX, node.x + halfWidth);
        minY = Math.min(minY, node.y - node.radius - (node.outgoing.has(node.id) ? node.radius * 2 : 10));
        maxY = Math.max(maxY, node.y + node.radius + 30);
      }
      camera.scale = Math.max(.02, Math.min(1.4, (width - padding * 2) / Math.max(1, maxX - minX),
        Math.max(80, height - top - bottom) / Math.max(1, maxY - minY)));
      camera.x = width / 2 - (minX + maxX) / 2 * camera.scale;
      camera.y = top + (height - top - bottom) / 2 - (minY + maxY) / 2 * camera.scale;
    }
    renderCamera();
    hideTooltip();
  }

  function zoomBy(factor, x = svg.clientWidth / 2, y = svg.clientHeight / 2) {
    if (gesture) return;
    stopLayout();
    const nextScale = Math.max(.02, Math.min(4, camera.scale * factor));
    const ratio = nextScale / camera.scale;
    camera.x = x - (x - camera.x) * ratio;
    camera.y = y - (y - camera.y) * ratio;
    camera.scale = nextScale;
    renderCamera();
    hideTooltip();
  }

  function revealNode(node) {
    stopLayout();
    const area = graphArea();
    const x = node.x * camera.scale + camera.x;
    const y = node.y * camera.scale + camera.y;
    if (x < 60 || x > area.width - 60 || y < area.top || y > area.height - area.bottom) {
      camera.x = area.width / 2 - node.x * camera.scale;
      camera.y = area.top + (area.height - area.top - area.bottom) / 2 - node.y * camera.scale;
      renderCamera();
    }
  }

  function updateHighlights() {
    const selected = nodeById.get(selectedId);
    for (const node of nodes) {
      const active = node.id === selectedId;
      const outgoing = !!selected?.outgoing.has(node.id) && !active;
      const incoming = !!selected?.incoming.has(node.id) && !active;
      const dimmed = selected ? !active && !outgoing && !incoming : !node.id.toLowerCase().includes(query);
      node.element.classList.toggle('hub', node.incoming.size === maxIncoming);
      node.element.classList.toggle('external', node.external);
      node.element.classList.toggle('selected', active);
      node.element.classList.toggle('outgoing', outgoing);
      node.element.classList.toggle('incoming', incoming && !outgoing);
      node.element.classList.toggle('both', outgoing && incoming);
      node.element.classList.toggle('dimmed', dimmed);
      node.element.setAttribute('aria-pressed', String(active));
      node.listButton.setAttribute('aria-pressed', String(active));
    }
    for (const edge of edges) {
      const outgoing = selectedId !== null && edge.from === selectedId;
      const incoming = selectedId !== null && edge.to === selectedId && !outgoing;
      const dimmed = selected ? !outgoing && !incoming : query !== '' &&
        !edge.from.toLowerCase().includes(query) && !edge.to.toLowerCase().includes(query);
      edge.element.classList.toggle('outgoing', outgoing);
      edge.element.classList.toggle('incoming', incoming);
      edge.element.classList.toggle('dimmed', dimmed);
      edge.flow.classList.toggle('outgoing', outgoing);
      edge.flow.classList.toggle('incoming', incoming);
    }
    // Raise related arrows. Keep nodes in place to preserve keyboard focus and tab order.
    if (selected) {
      for (const edge of edges) if (edge.from === selectedId || edge.to === selectedId) $('edges').append(edge.element, edge.flow);
    }
  }

  function relationList(element, ids, emptyText) {
    element.replaceChildren();
    if (!ids.size) {
      const item = document.createElement('li');
      item.className = 'relation-empty';
      item.textContent = emptyText;
      element.append(item);
    }
    for (const id of [...ids].sort()) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'relation-button';
      button.title = id;
      const label = document.createElement('span');
      label.className = 'module-label';
      label.textContent = id;
      const arrow = document.createElement('span');
      arrow.className = 'relation-arrow';
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(label, arrow);
      button.addEventListener('click', () => { selectNode(id); revealNode(nodeById.get(id)); });
      item.append(button);
      element.append(item);
    }
  }

  function selectNode(id) {
    selectedId = id;
    const node = nodeById.get(id);
    $('overview').hidden = !!node;
    $('inspector').hidden = !node;
    hideTooltip();
    if (node) {
      $('selected-name').textContent = node.id;
      $('selected-intro').textContent = node.intro || 'No description yet.';
      $('module-kind').textContent = node.external ? 'EXTERNAL DEPENDENCY' : 'SELECTED MODULE';
      $('outgoing-count').textContent = $('outgoing-label').textContent = node.outgoing.size;
      $('incoming-count').textContent = $('incoming-label').textContent = node.incoming.size;
      $('document-link').hidden = !node.document;
      if (node.document) $('document-link').href = node.document;
      else $('document-link').removeAttribute('href');
      relationList($('outgoing-list'), node.outgoing, 'No dependencies. All self-contained.');
      relationList($('incoming-list'), node.incoming, 'No other modules depend on this one.');
      $('announcement').textContent = `${node.id} selected. ${node.outgoing.size} dependencies, ${node.incoming.size} dependents.`;
    } else $('announcement').textContent = 'Selection cleared. Showing all modules.';
    updateHighlights();
  }

  for (const node of nodes) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-row';
    button.title = `${node.id} · ${node.incoming.size} dependents`;
    button.dataset.id = node.id;
    const dot = document.createElement('span');
    dot.className = 'module-dot';
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'module-label';
    label.textContent = node.id;
    button.append(dot, label);
    if (node.external) {
      const tag = document.createElement('span');
      tag.className = 'external-tag';
      tag.textContent = 'EXT';
      button.append(tag);
    }
    const count = document.createElement('span');
    count.className = 'dependent-badge';
    count.textContent = node.incoming.size;
    count.setAttribute('aria-label', `${node.incoming.size} dependents`);
    button.append(count);
    button.addEventListener('click', () => { selectNode(node.id); revealNode(node); });
    item.append(button);
    $('module-list').append(item);
    node.listItem = item;
    node.listButton = button;
  }

  function filterModules() {
    query = search.value.trim().toLowerCase();
    let count = 0;
    for (const node of nodes) {
      node.listItem.hidden = !node.id.toLowerCase().includes(query);
      if (!node.listItem.hidden) count++;
    }
    $('list-count').textContent = query ? `${count} / ${nodes.length}` : nodes.length;
    $('no-results').hidden = count > 0 || !query;
    updateHighlights();
  }
  search.addEventListener('input', filterModules);
  $('clear-selection').addEventListener('click', () => selectNode(null));
  document.addEventListener('keydown', event => {
    const editing = event.target instanceof HTMLInputElement;
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape') {
      search.value = '';
      filterModules();
      selectNode(null);
      search.blur();
    }
  });

  function hideTooltip() { tooltip.hidden = true; }
  function showTooltip(node, event) {
    if (gesture || event.pointerType === 'touch') return;
    tooltip.textContent = node.intro || node.id;
    tooltip.hidden = false;
    const rect = svg.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX - rect.left + 18, rect.width - tooltip.offsetWidth - 12))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(event.clientY - rect.top + 18, rect.height - tooltip.offsetHeight - 12))}px`;
  }

  function stopLayout() {
    cancelAnimationFrame(layoutFrame);
    svg.dataset.settled = 'true';
  }

  function stopElasticMotion() {
    cancelAnimationFrame(elasticFrame);
    elasticMotion = null;
    svg.dataset.motion = 'idle';
  }

  function beginElasticDrag(root) {
    // Preserve the current layout with local anchors and vector springs. A pull
    // propagates up to three connections away, without moving separate components.
    const distances = new Map([[root, 0]]);
    const queue = [root];
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index];
      const depth = distances.get(node);
      if (depth === 3) continue;
      for (const id of new Set([...node.incoming, ...node.outgoing])) {
        const neighbor = nodeById.get(id);
        if (!distances.has(neighbor)) {
          distances.set(neighbor, depth + 1);
          queue.push(neighbor);
        }
      }
    }
    const members = new Map(queue.map(node => [node, {
      node, depth: distances.get(node), homeX: node.x, homeY: node.y, vx: 0, vy: 0, fx: 0, fy: 0
    }]));
    const springs = [];
    for (const edge of edges) {
      if (edge.source === edge.target || !members.has(edge.source) || !members.has(edge.target)) continue;
      // A reciprocal pair has two arrows but only one physical connection.
      if (edge.from > edge.to && edge.target.outgoing.has(edge.from)) continue;
      const degree = Math.max(1, edge.source.incoming.size + edge.source.outgoing.size,
        edge.target.incoming.size + edge.target.outgoing.size);
      springs.push({ a: members.get(edge.source), b: members.get(edge.target),
        dx: edge.target.x - edge.source.x, dy: edge.target.y - edge.source.y, strength: .08 / Math.sqrt(degree) });
    }
    elasticMotion = { root, members, springs, lastTime: performance.now(), accumulator: 0,
      releasedAt: null, quietSteps: 0 };
    svg.dataset.motion = 'dragging';
    if (!reducedMotion) elasticFrame = requestAnimationFrame(animateElasticMotion);
  }

  function elasticStep(motion) {
    for (const member of motion.members.values()) {
      const anchorStrength = .055 + Math.max(0, member.depth - 1) * .04;
      member.fx = (member.homeX - member.node.x) * anchorStrength;
      member.fy = (member.homeY - member.node.y) * anchorStrength;
    }
    for (const spring of motion.springs) {
      const fx = (spring.b.node.x - spring.a.node.x - spring.dx) * spring.strength;
      const fy = (spring.b.node.y - spring.a.node.y - spring.dy) * spring.strength;
      spring.a.fx += fx; spring.a.fy += fy;
      spring.b.fx -= fx; spring.b.fy -= fy;
    }
    let speed = 0;
    let force = 0;
    for (const member of motion.members.values()) {
      if (member.node === motion.root) continue; // The grabbed node stays exactly under the pointer.
      member.vx = (member.vx + member.fx) * .76;
      member.vy = (member.vy + member.fy) * .76;
      const limit = Math.max(1, Math.hypot(member.vx, member.vy) / 12);
      member.node.x += member.vx / limit;
      member.node.y += member.vy / limit;
      speed = Math.max(speed, Math.hypot(member.vx, member.vy));
      force = Math.max(force, Math.hypot(member.fx, member.fy));
    }
    motion.quietSteps = speed < .018 && force < .012 ? motion.quietSteps + 1 : 0;
  }

  function animateElasticMotion(time) {
    const motion = elasticMotion;
    if (!motion) return;
    // Fixed steps keep the spring response consistent on 60 Hz and 120 Hz screens.
    motion.accumulator += Math.min(50, time - motion.lastTime);
    motion.lastTime = time;
    while (motion.accumulator >= 1000 / 60) {
      elasticStep(motion);
      motion.accumulator -= 1000 / 60;
    }
    renderPositions();
    if (motion.releasedAt !== null && (motion.quietSteps >= 6 || time - motion.releasedAt > 2400)) {
      stopElasticMotion();
      return;
    }
    elasticFrame = requestAnimationFrame(animateElasticMotion);
  }

  function moveReducedMotionNeighbors() {
    // Keep the connection feedback, but omit inertia and oscillation when requested.
    const motion = elasticMotion;
    const origin = motion.members.get(motion.root);
    const dx = motion.root.x - origin.homeX;
    const dy = motion.root.y - origin.homeY;
    for (const member of motion.members.values()) {
      if (member.node === motion.root) continue;
      const influence = .28 ** member.depth;
      member.node.x = member.homeX + dx * influence;
      member.node.y = member.homeY + dy * influence;
    }
  }

  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture) return;
    stopLayout();
    stopElasticMotion();
    hideTooltip();
    const group = event.target.closest('.node');
    const node = group ? nodeById.get(group.dataset.id) : null;
    if (node) node.element.classList.add('held');
    gesture = { pointer: event.pointerId, node, startX: event.clientX, startY: event.clientY,
      x: node ? node.x : camera.x, y: node ? node.y : camera.y, moved: false };
    svg.setPointerCapture(event.pointerId);
  });
  function moveGesture(event) {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > 3) gesture.moved = true;
    if (!gesture.moved) return;
    svg.classList.add('dragging');
    if (gesture.node) {
      if (!elasticMotion) {
        beginElasticDrag(gesture.node);
        selectNode(gesture.node.id);
      }
      gesture.node.x = gesture.x + dx / camera.scale;
      gesture.node.y = gesture.y + dy / camera.scale;
      if (reducedMotion) moveReducedMotionNeighbors();
      renderPositions();
    } else {
      camera.x = gesture.x + dx;
      camera.y = gesture.y + dy;
      renderCamera();
    }
  }
  svg.addEventListener('pointermove', moveGesture);
  function finishGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    // Browsers may coalesce pointer moves. Apply the release coordinates too,
    // so a quick drag always reaches its final position.
    if (event.type === 'pointerup') moveGesture(event);
    const finished = gesture;
    gesture = null;
    svg.classList.remove('dragging');
    if (finished.node) finished.node.element.classList.remove('held');
    if (elasticMotion) {
      elasticMotion.releasedAt = performance.now();
      svg.dataset.motion = 'settling';
      if (reducedMotion) stopElasticMotion();
    }
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup') {
      if (finished.node) selectNode(finished.node.id);
      else if (!finished.moved) selectNode(null);
    }
  }
  svg.addEventListener('pointerup', finishGesture);
  svg.addEventListener('pointercancel', finishGesture);
  svg.addEventListener('lostpointercapture', finishGesture);
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    zoomBy(Math.exp(-Math.max(-200, Math.min(200, delta)) * .002), event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
  $('zoom-in').addEventListener('click', () => zoomBy(1.2));
  $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.2));
  $('fit-view').addEventListener('click', () => { stopLayout(); stopElasticMotion(); fitView(); });

  // A short deterministic initial layout. Dragging uses the local springs above.
  // Work is split across frames so larger maps do not block the controls.
  function layoutStep() {
    for (const node of nodes) { node.fx = -node.x * .008; node.fy = -node.y * .008; }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x || .01;
        const dy = b.y - a.y || .01;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const gap = a.radius + b.radius + 70;
        const force = 6000 / (distance * distance) + Math.max(0, gap - distance) * .09;
        const fx = dx / distance * force;
        const fy = dy / distance * force;
        a.fx -= fx; a.fy -= fy;
        b.fx += fx; b.fy += fy;
      }
    }
    for (const edge of edges) {
      if (edge.source === edge.target) continue;
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 170) * .018;
      const fx = dx / distance * force;
      const fy = dy / distance * force;
      edge.source.fx += fx; edge.source.fy += fy;
      edge.target.fx -= fx; edge.target.fy -= fy;
    }
    for (const node of nodes) {
      node.vx = (node.vx + node.fx) * .65;
      node.vy = (node.vy + node.fy) * .65;
      const speed = Math.max(1, Math.hypot(node.vx, node.vy) / 8);
      node.x += node.vx / speed;
      node.y += node.vy / speed;
    }
  }

  let remainingSteps = nodes.length > 150 ? 160 : 240;
  function settleLayout() {
    const start = performance.now();
    do { layoutStep(); remainingSteps--; } while (remainingSteps > 0 && performance.now() - start < 8);
    // With reduced motion, only reveal the final layout.
    if (!reducedMotion || remainingSteps === 0) { renderPositions(); fitView(); }
    if (remainingSteps > 0) layoutFrame = requestAnimationFrame(settleLayout);
    else svg.dataset.settled = 'true';
  }
  new ResizeObserver(() => { if (!gesture) { stopElasticMotion(); fitView(); } }).observe(svg);
  filterModules();
  renderPositions();
  fitView();
  if (nodes.length) layoutFrame = requestAnimationFrame(settleLayout);
  else svg.dataset.settled = 'true';
})();
