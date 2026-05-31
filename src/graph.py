"""HTML dependency graph generation using vis.js."""

from pathlib import Path

from .models import Project


def generate_html(project: Project) -> str:
    """Generate a self-contained HTML page with an interactive dependency graph.

    Args:
        project: The project to visualize.

    Returns:
        Complete HTML string ready to write to a file.
    """
    root_modules = set(project.root_modules())
    nodes_js = _build_nodes(project, root_modules)
    edges_js = _build_edges(project)
    docs_json = _build_docs_json(project)

    html = _HTML_TEMPLATE
    html = html.replace("__PROJECT_NAME__", project.name)
    html = html.replace("__NODES__", nodes_js)
    html = html.replace("__EDGES__", edges_js)
    html = html.replace("__DOCS_JSON__", docs_json)
    return html


def _build_nodes(project: Project, root_modules: set[str]) -> str:
    """Build vis.js node dataset as a JS array string."""
    lines = []
    for name, module in sorted(project.modules.items()):
        is_root = name in root_modules
        color = "#42a5f5" if is_root else "#ff5252"
        hover = "#1565c0" if is_root else "#c62828"
        pressed = "#0d47a1" if is_root else "#b71c1c"
        size = 25 + len(module.requirements) * 5
        lines.append(
            f'  {{ id: "{_escape_js(name)}", label: "{_escape_js(name)}", '
            f'title: "{_escape_js(module.intro)}", '
            f'size: {size}, '
            f'color: {{ background: "{color}", border: "{color}", highlight: {{ background: "{pressed}", border: "{pressed}" }}, hover: {{ background: "{hover}", border: "{hover}" }} }} }}'
        )
    return ",\n".join(lines)


def _build_edges(project: Project) -> str:
    """Build vis.js edge dataset as a JS array string."""
    lines = []
    for name, module in sorted(project.modules.items()):
        for req in module.requirements:
            if req in project.modules:
                lines.append(f'  {{ from: "{_escape_js(req)}", to: "{_escape_js(name)}" }}')
    return ",\n".join(lines)


def _build_docs_json(project: Project) -> str:
    """Build a JSON object mapping module names to absolute document URLs."""
    entries = []
    for name, module in sorted(project.modules.items()):
        if module.document:
            doc_path = (module.path / module.document).resolve()
            url = doc_path.as_uri()
            entries.append(f'  "{_escape_js(name)}": "{_escape_js(url)}"')
        else:
            entries.append(f'  "{_escape_js(name)}": ""')
    return "{\n" + ",\n".join(entries) + "\n}"


def _escape_js(s: str) -> str:
    """Escape a string for safe embedding in JS string literals."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>__PROJECT_NAME__ - Module Dependencies</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; }
  #header {
    padding: 12px 20px;
    background: #16213e;
    color: #e0e0e0;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid #2a2a4a;
  }
  #network { width: 100%; height: calc(100vh - 44px); }
  #context-menu {
    display: none;
    position: absolute;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    padding: 4px 0;
    z-index: 1000;
    min-width: 160px;
  }
  #context-menu .menu-item {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #d0d0d0;
  }
  #context-menu .menu-item:hover {
    background: #3a3a6a;
  }
  #context-menu .menu-item.disabled {
    color: #666;
    cursor: default;
  }
  #context-menu .menu-item.disabled:hover {
    background: transparent;
  }
  #minimap {
    position: fixed;
    bottom: 12px;
    right: 12px;
    width: 200px;
    height: 150px;
    background: #12122a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    z-index: 500;
    cursor: pointer;
  }
  #legend {
    display: none;
    position: fixed;
    bottom: 174px;
    right: 12px;
    background: #2a2a4a;
    border: 1px solid #3a3a5a;
    border-radius: 6px;
    padding: 10px 14px;
    z-index: 500;
    font-size: 13px;
    color: #d0d0d0;
  }
  #legend .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }
  #legend .legend-item:last-child { margin-bottom: 0; }
  #legend .legend-line {
    display: inline-block;
    width: 24px;
    height: 3px;
    margin-right: 8px;
    border-radius: 2px;
  }
</style>
</head>
<body>
<div id="header">__PROJECT_NAME__</div>
<div id="network"></div>
<canvas id="minimap" width="200" height="150"></canvas>
<div id="legend">
  <div class="legend-item"><span class="legend-line" style="background:#ffab40"></span>Direct dependency</div>
  <div class="legend-item"><span class="legend-line" style="background:#4da6ff"></span>Indirect dependency</div>
</div>
<div id="context-menu">
  <div class="menu-item" id="menu-open-doc">Open Document</div>
</div>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<script>
var docsMap = __DOCS_JSON__;

var nodes = new vis.DataSet([
__NODES__
]);

var edges = new vis.DataSet([
__EDGES__
]);

var container = document.getElementById("network");
var data = { nodes: nodes, edges: edges };
var options = {
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.8 } },
    color: { color: "#555580", highlight: "#4da6ff", hover: "#8a8ab0" },
    width: 1.5,
    smooth: false
  },
  nodes: {
    shape: "dot",
    size: 28,
    font: { size: 16, face: "sans-serif", color: "#f0f0f0", strokeWidth: 4, strokeColor: "#1a1a2e", vadjust: 10 },
    borderWidth: 0,
    shadow: { enabled: false },
    color: {
      hover: { background: "#888", border: "#888" }
    }
  },
  physics: {
    solver: "barnesHut",
    barnesHut: { gravitationalConstant: -3000, centralGravity: 0.2, springLength: 250, springConstant: 0.04, avoidOverlap: 0.8, damping: 0.9 },
    stabilization: { iterations: 300, fit: true }
  },
  interaction: {
    hover: true,
    tooltipDelay: 100,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: false,
    multiselect: false
  }
};

var network = new vis.Network(container, data, options);

// Dependency highlight on node selection
var EDGE_DEFAULT = "#555580";
var EDGE_DIRECT = "#ffab40";
var EDGE_INDIRECT = "#4da6ff";
var NODE_DEFAULT_OPACITY = 1;
var NODE_DIM_OPACITY = 0.15;
var EDGE_DIM_WIDTH = 0.5;
var legendEl = document.getElementById("legend");

// Cache original node colors for reset
var originalNodeColors = {};
var pressedNodeColors = {};
nodes.forEach(function(n) {
  originalNodeColors[n.id] = n.color && n.color.background ? n.color.background : "#42a5f5";
  pressedNodeColors[n.id] = n.color && n.color.highlight && n.color.highlight.background ? n.color.highlight.background : "#0d47a1";
});

function getDependencies(nodeId) {
  var direct = [];
  var indirect = [];
  var visited = {};
  visited[nodeId] = true;
  var queue = [];
  // Seed queue with direct dependencies (depth 1) — edges now point FROM dependency TO dependent
  edges.forEach(function(e) {
    if (e.to === nodeId && !visited[e.from]) {
      visited[e.from] = true;
      direct.push(e.from);
      queue.push(e.from);
    }
  });
  // BFS for indirect dependencies
  while (queue.length > 0) {
    var current = queue.shift();
    edges.forEach(function(e) {
      if (e.to === current && !visited[e.from]) {
        visited[e.from] = true;
        indirect.push(e.from);
        queue.push(e.from);
      }
    });
  }
  return { direct: direct, indirect: indirect };
}

function highlightDependencies(nodeId) {
  var deps = getDependencies(nodeId);
  var relatedIds = {};
  relatedIds[nodeId] = true;
  for (var i = 0; i < deps.direct.length; i++) relatedIds[deps.direct[i]] = true;
  for (var j = 0; j < deps.indirect.length; j++) relatedIds[deps.indirect[j]] = true;

  // Update edges
  var edgeUpdates = [];
  edges.forEach(function(e) {
    var isDirect = (e.to === nodeId && deps.direct.indexOf(e.from) !== -1);
    var isIndirect = (e.to === nodeId && deps.indirect.indexOf(e.from) !== -1);
    // Also highlight edges between dependency nodes
    if (!isDirect && !isIndirect && relatedIds[e.from] && relatedIds[e.to]) {
      isIndirect = true;
    }
    if (isDirect) {
      edgeUpdates.push({ id: e.id, color: { color: EDGE_DIRECT, highlight: EDGE_DIRECT, hover: EDGE_DIRECT }, width: 3, hidden: false });
    } else if (isIndirect) {
      edgeUpdates.push({ id: e.id, color: { color: EDGE_INDIRECT, highlight: EDGE_INDIRECT, hover: EDGE_INDIRECT }, width: 2, hidden: false });
    } else {
      edgeUpdates.push({ id: e.id, color: { color: EDGE_DEFAULT, highlight: EDGE_DEFAULT, hover: EDGE_DEFAULT }, width: EDGE_DIM_WIDTH, hidden: false });
    }
  });
  edges.update(edgeUpdates);

  // Update nodes
  var allNodeIds = nodes.getIds();
  var nodeUpdates = [];
  for (var k = 0; k < allNodeIds.length; k++) {
    var nid = allNodeIds[k];
    if (nid === nodeId) {
      var pressedBg = pressedNodeColors[nid] || "#0d47a1";
      nodeUpdates.push({ id: nid, opacity: NODE_DEFAULT_OPACITY, color: { background: pressedBg, border: pressedBg } });
    } else if (relatedIds[nid]) {
      nodeUpdates.push({ id: nid, opacity: NODE_DEFAULT_OPACITY });
    } else {
      nodeUpdates.push({ id: nid, opacity: NODE_DIM_OPACITY });
    }
  }
  nodes.update(nodeUpdates);

  legendEl.style.display = "block";
}

function resetHighlight() {
  var edgeUpdates = [];
  edges.forEach(function(e) {
    edgeUpdates.push({ id: e.id, color: { color: EDGE_DEFAULT, highlight: "#4da6ff", hover: "#8a8ab0" }, width: 1.5 });
  });
  edges.update(edgeUpdates);

  var allNodeIds = nodes.getIds();
  var nodeUpdates = [];
  for (var k = 0; k < allNodeIds.length; k++) {
    var nid = allNodeIds[k];
    var bg = originalNodeColors[nid] || "#42a5f5";
    nodeUpdates.push({ id: nid, opacity: NODE_DEFAULT_OPACITY, color: { background: bg, border: bg } });
  }
  nodes.update(nodeUpdates);

  legendEl.style.display = "none";
}

network.on("selectNode", function(params) {
  if (params.nodes.length > 0) {
    highlightDependencies(params.nodes[0]);
  }
});

network.on("deselectNode", function() {
  resetHighlight();
});

// Minimap
var minimapCanvas = document.getElementById("minimap");
var mctx = minimapCanvas.getContext("2d");
var mW = minimapCanvas.width, mH = minimapCanvas.height;
var mPadding = 10;

function drawMinimap() {
  var positions = network.getPositions();
  var ids = Object.keys(positions);
  if (ids.length === 0) return;

  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < ids.length; i++) {
    var p = positions[ids[i]];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  var gW = maxX - minX || 1, gH = maxY - minY || 1;
  var scale = Math.min((mW - 2 * mPadding) / gW, (mH - 2 * mPadding) / gH);
  var offX = mPadding + ((mW - 2 * mPadding) - gW * scale) / 2;
  var offY = mPadding + ((mH - 2 * mPadding) - gH * scale) / 2;

  function toMini(x, y) {
    return { x: offX + (x - minX) * scale, y: offY + (y - minY) * scale };
  }

  mctx.clearRect(0, 0, mW, mH);

  // Draw edges
  mctx.strokeStyle = "#6a6a8e";
  mctx.lineWidth = 0.5;
  edges.forEach(function(e) {
    var from = positions[e.from], to = positions[e.to];
    if (!from || !to) return;
    var a = toMini(from.x, from.y), b = toMini(to.x, to.y);
    mctx.beginPath();
    mctx.moveTo(a.x, a.y);
    mctx.lineTo(b.x, b.y);
    mctx.stroke();
  });

  // Draw nodes
  for (var j = 0; j < ids.length; j++) {
    var id = ids[j];
    var np = toMini(positions[id].x, positions[id].y);
    var node = nodes.get(id);
    mctx.fillStyle = node.color && node.color.background ? node.color.background : "#4da6ff";
    mctx.beginPath();
    mctx.arc(np.x, np.y, 3, 0, 2 * Math.PI);
    mctx.fill();
  }

  // Draw viewport rectangle
  var vw = container.clientWidth, vh = container.clientHeight;
  var vp = network.getViewPosition();
  var vz = network.getScale();
  var tl = toMini(vp.x - vw / (2 * vz), vp.y - vh / (2 * vz));
  var br = toMini(vp.x + vw / (2 * vz), vp.y + vh / (2 * vz));
  mctx.strokeStyle = "#4da6ff";
  mctx.lineWidth = 1.5;
  mctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
}

network.on("stabilizationIterationsDone", drawMinimap);
network.on("afterDrawing", drawMinimap);
setTimeout(drawMinimap, 500);

// Click on minimap to pan
minimapCanvas.addEventListener("click", function(e) {
  var rect = minimapCanvas.getBoundingClientRect();
  var cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  var positions = network.getPositions();
  var ids = Object.keys(positions);
  if (ids.length === 0) return;

  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < ids.length; i++) {
    var p = positions[ids[i]];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  var gW = maxX - minX || 1, gH = maxY - minY || 1;
  var scale = Math.min((mW - 2 * mPadding) / gW, (mH - 2 * mPadding) / gH);
  var offX = mPadding + ((mW - 2 * mPadding) - gW * scale) / 2;
  var offY = mPadding + ((mH - 2 * mPadding) - gH * scale) / 2;
  var gx = (cx - offX) / scale + minX;
  var gy = (cy - offY) / scale + minY;
  network.moveTo({ position: { x: gx, y: gy }, animation: { duration: 200, easingFunction: "easeInOutQuad" } });
});

// Context menu
var contextMenu = document.getElementById("context-menu");
var menuOpenDoc = document.getElementById("menu-open-doc");
var selectedNode = null;

container.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  var nodeId = network.getNodeAt({ x: e.offsetX, y: e.offsetY });
  if (nodeId) {
    selectedNode = nodeId;
    var hasDoc = docsMap[nodeId] && docsMap[nodeId].length > 0;
    menuOpenDoc.className = hasDoc ? "menu-item" : "menu-item disabled";
    menuOpenDoc.textContent = hasDoc ? "Open Document: " + nodeId : "No document for " + nodeId;
    contextMenu.style.display = "block";
    contextMenu.style.left = e.pageX + "px";
    contextMenu.style.top = e.pageY + "px";
  } else {
    contextMenu.style.display = "none";
    selectedNode = null;
  }
});

document.addEventListener("click", function() {
  contextMenu.style.display = "none";
});

menuOpenDoc.addEventListener("click", function() {
  if (selectedNode && docsMap[selectedNode]) {
    window.open(docsMap[selectedNode], "_blank");
  }
  contextMenu.style.display = "none";
});
</script>
</body>
</html>"""
