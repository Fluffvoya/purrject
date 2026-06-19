using System.Text;

namespace Purrject.Services;

public class GraphService
{
    public void GenerateGraph(ProjectInfo project, string outputPath)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html lang=\"en\">");
        sb.AppendLine("<head>");
        sb.AppendLine("  <meta charset=\"UTF-8\">");
        sb.AppendLine("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        sb.AppendLine($"  <title>{project.Name} - Module Dependencies</title>");
        sb.AppendLine("  <script src=\"https://unpkg.com/vis-network/standalone/umd/vis-network.min.js\"></script>");
        sb.AppendLine("  <style>");
        sb.AppendLine("    * { margin: 0; padding: 0; box-sizing: border-box; }");
        sb.AppendLine("    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; }");
        sb.AppendLine("    #header { padding: 16px 24px; background: #16213e; border-bottom: 1px solid #0f3460; }");
        sb.AppendLine("    #header h1 { font-size: 20px; font-weight: 600; }");
        sb.AppendLine("    #header span { color: #a8a8a8; font-size: 14px; margin-left: 8px; }");
        sb.AppendLine("    #graph { width: 100%; height: calc(100vh - 57px); }");
        sb.AppendLine("    .tooltip { position: absolute; padding: 8px 12px; background: #16213e; border: 1px solid #0f3460; border-radius: 6px; font-size: 13px; color: #eee; pointer-events: none; z-index: 10; max-width: 300px; }");
        sb.AppendLine("    #minimap { position: absolute; bottom: 16px; right: 16px; width: 200px; height: 150px; border: 1px solid #0f3460; border-radius: 6px; background: #1a1a2e; overflow: hidden; z-index: 5; }");
        sb.AppendLine("    #minimap-viewport { position: absolute; border: 2px solid #e94560; background: rgba(233,69,96,0.1); pointer-events: none; }");
        sb.AppendLine("  </style>");
        sb.AppendLine("</head>");
        sb.AppendLine("<body>");
        sb.AppendLine($"  <div id=\"header\"><h1>{project.Name}<span>Module Dependencies</span></h1></div>");
        sb.AppendLine("  <div id=\"graph\"></div>");
        sb.AppendLine("  <div id=\"minimap\"><canvas id=\"minimap-canvas\"></canvas><div id=\"minimap-viewport\"></div></div>");
        sb.AppendLine("  <script>");

        // Count how many modules depend on each module
        var dependentCount = new Dictionary<string, int>();
        foreach (var (name, module) in project.Modules)
        {
            dependentCount.TryAdd(name, 0);
            foreach (var dep in module.Requirements)
            {
                dependentCount.TryAdd(dep, 0);
                dependentCount[dep]++;
            }
        }
        var maxDeps = dependentCount.Values.DefaultIfEmpty(1).Max();

        sb.AppendLine("    const nodes = new vis.DataSet([");

        var outputDir = Path.GetDirectoryName(Path.GetFullPath(outputPath))!;

        foreach (var (name, module) in project.Modules)
        {
            var escapedIntro = EscapeJs(module.Intro);
            // Resolve document path as absolute file:// URL
            var docUrl = "";
            if (!string.IsNullOrEmpty(module.Document))
            {
                var absDoc = Path.GetFullPath(Path.Combine(module.Path, module.Document));
                docUrl = "file:///" + absDoc.Replace("\\", "/");
            }
            var escapedDoc = EscapeJs(docUrl);
            var count = dependentCount.GetValueOrDefault(name, 0);
            var size = 16 + (maxDeps > 0 ? 18.0 * count / maxDeps : 0);
            sb.AppendLine($"      {{ id: '{name}', label: '{name}', title: '{escapedIntro}', doc: '{escapedDoc}', color: {{ background: '#e94560', border: '#c81e45', highlight: {{ background: '#ff6b81', border: '#e94560' }} }}, font: {{ color: '#fff', size: 14 }}, shape: 'dot', size: {size:F1} }},");
        }

        sb.AppendLine("    ]);");
        sb.AppendLine("    const edges = new vis.DataSet([");

        foreach (var (name, module) in project.Modules)
        {
            foreach (var dep in module.Requirements)
            {
                sb.AppendLine($"      {{ from: '{name}', to: '{dep}', arrows: 'to', color: {{ color: '#555', highlight: '#e94560', hover: '#e94560' }}, smooth: false }},");
            }
        }

        sb.AppendLine("    ]);");
        sb.AppendLine("    const container = document.getElementById('graph');");
        sb.AppendLine("    const network = new vis.Network(container, { nodes, edges }, {");
        sb.AppendLine("      physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -80, springLength: 120, springConstant: 0.04 } },");
        sb.AppendLine("      interaction: { hover: true, tooltipDelay: 200 },");
        sb.AppendLine("      edges: { smooth: false, width: 1.5 }");
        sb.AppendLine("    });");

        // Minimap
        sb.AppendLine("    const minimapCanvas = document.getElementById('minimap-canvas');");
        sb.AppendLine("    const minimapViewport = document.getElementById('minimap-viewport');");
        sb.AppendLine("    const minimapContainer = document.getElementById('minimap');");
        sb.AppendLine("    const ctx = minimapCanvas.getContext('2d');");
        sb.AppendLine("    minimapCanvas.width = 200;");
        sb.AppendLine("    minimapCanvas.height = 150;");
        sb.AppendLine("");
        sb.AppendLine("    function updateMinimap() {");
        sb.AppendLine("      const nodePositions = network.getPositions();");
        sb.AppendLine("      const allX = Object.values(nodePositions).map(p => p.x);");
        sb.AppendLine("      const allY = Object.values(nodePositions).map(p => p.y);");
        sb.AppendLine("      if (allX.length === 0) return;");
        sb.AppendLine("      const minX = Math.min(...allX) - 50, maxX = Math.max(...allX) + 50;");
        sb.AppendLine("      const minY = Math.min(...allY) - 50, maxY = Math.max(...allY) + 50;");
        sb.AppendLine("      const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;");
        sb.AppendLine("      const scaleX = 200 / rangeX, scaleY = 150 / rangeY;");
        sb.AppendLine("      const scale = Math.min(scaleX, scaleY);");
        sb.AppendLine("      const offsetX = (200 - rangeX * scale) / 2;");
        sb.AppendLine("      const offsetY = (150 - rangeY * scale) / 2;");
        sb.AppendLine("");
        sb.AppendLine("      ctx.clearRect(0, 0, 200, 150);");
        sb.AppendLine("      edges.forEach(e => {");
        sb.AppendLine("        const from = nodePositions[e.from], to = nodePositions[e.to];");
        sb.AppendLine("        if (!from || !to) return;");
        sb.AppendLine("        ctx.beginPath();");
        sb.AppendLine("        ctx.moveTo((from.x - minX) * scale + offsetX, (from.y - minY) * scale + offsetY);");
        sb.AppendLine("        ctx.lineTo((to.x - minX) * scale + offsetX, (to.y - minY) * scale + offsetY);");
        sb.AppendLine("        ctx.strokeStyle = '#555';");
        sb.AppendLine("        ctx.lineWidth = 0.5;");
        sb.AppendLine("        ctx.stroke();");
        sb.AppendLine("      });");
        sb.AppendLine("      nodes.forEach(n => {");
        sb.AppendLine("        const p = nodePositions[n.id];");
        sb.AppendLine("        if (!p) return;");
        sb.AppendLine("        ctx.beginPath();");
        sb.AppendLine("        const r = Math.max(1.5, (n.size || 20) * scale * 0.08);");
        sb.AppendLine("        ctx.arc((p.x - minX) * scale + offsetX, (p.y - minY) * scale + offsetY, r, 0, 2 * Math.PI);");
        sb.AppendLine("        ctx.fillStyle = '#e94560';");
        sb.AppendLine("        ctx.fill();");
        sb.AppendLine("      });");
        sb.AppendLine("");
        sb.AppendLine("      const vp = network.getViewPosition();");
        sb.AppendLine("      const zoom = network.getScale();");
        sb.AppendLine("      const containerRect = container.getBoundingClientRect();");
        sb.AppendLine("      const vpW = containerRect.width / zoom * scale;");
        sb.AppendLine("      const vpH = containerRect.height / zoom * scale;");
        sb.AppendLine("      const vpX = (vp.x - minX) * scale + offsetX - vpW / 2;");
        sb.AppendLine("      const vpY = (vp.y - minY) * scale + offsetY - vpH / 2;");
        sb.AppendLine("      minimapViewport.style.left = vpX + 'px';");
        sb.AppendLine("      minimapViewport.style.top = vpY + 'px';");
        sb.AppendLine("      minimapViewport.style.width = vpW + 'px';");
        sb.AppendLine("      minimapViewport.style.height = vpH + 'px';");
        sb.AppendLine("    }");
        sb.AppendLine("");
        sb.AppendLine("    network.on('afterDrawing', updateMinimap);");
        sb.AppendLine("    network.on('dragEnd', updateMinimap);");
        sb.AppendLine("    network.on('zoom', updateMinimap);");

        // Tooltip
        sb.AppendLine("    let tooltip = null;");
        sb.AppendLine("    network.on('hoverNode', function(params) {");
        sb.AppendLine("      const node = nodes.get(params.node);");
        sb.AppendLine("      if (!node.title) return;");
        sb.AppendLine("      tooltip = document.createElement('div');");
        sb.AppendLine("      tooltip.className = 'tooltip';");
        sb.AppendLine("      tooltip.textContent = node.title;");
        sb.AppendLine("      const rect = container.getBoundingClientRect();");
        sb.AppendLine("      tooltip.style.left = (params.event.center.x - rect.left + 15) + 'px';");
        sb.AppendLine("      tooltip.style.top = (params.event.center.y - rect.top + 15) + 'px';");
        sb.AppendLine("      container.appendChild(tooltip);");
        sb.AppendLine("    });");
        sb.AppendLine("    network.on('blurNode', function() {");
        sb.AppendLine("      if (tooltip) { tooltip.remove(); tooltip = null; }");
        sb.AppendLine("    });");

        // Click highlight
        sb.AppendLine("    let selectedNodeId = null;");
        sb.AppendLine("    network.on('click', function(params) {");
        sb.AppendLine("      if (params.nodes.length > 0) {");
        sb.AppendLine("        const nodeId = params.nodes[0];");
        sb.AppendLine("        selectedNodeId = nodeId;");
        sb.AppendLine("        const connected = network.getConnectedNodes(nodeId, 'to');");
        sb.AppendLine("        const allNodes = nodes.getIds();");
        sb.AppendLine("        allNodes.forEach(id => {");
        sb.AppendLine("          if (id === nodeId || connected.includes(id)) {");
        sb.AppendLine("            nodes.update({ id, opacity: 1 });");
        sb.AppendLine("          } else {");
        sb.AppendLine("            nodes.update({ id, opacity: 0.15 });");
        sb.AppendLine("          }");
        sb.AppendLine("        });");
        sb.AppendLine("        const allEdges = edges.getIds();");
        sb.AppendLine("        allEdges.forEach(id => {");
        sb.AppendLine("          const edge = edges.get(id);");
        sb.AppendLine("          if (edge.from === nodeId || edge.to === nodeId) {");
        sb.AppendLine("            edges.update({ id, color: { color: '#e94560' }, width: 2.5 });");
        sb.AppendLine("          } else {");
        sb.AppendLine("            edges.update({ id, color: { color: '#333' }, width: 1 });");
        sb.AppendLine("          }");
        sb.AppendLine("        });");
        sb.AppendLine("      } else {");
        sb.AppendLine("        selectedNodeId = null;");
        sb.AppendLine("        nodes.getIds().forEach(id => nodes.update({ id, opacity: 1 }));");
        sb.AppendLine("        edges.getIds().forEach(id => edges.update({ id, color: { color: '#555' }, width: 1.5 }));");
        sb.AppendLine("      }");
        sb.AppendLine("    });");

        // Double-click selected node to open document
        sb.AppendLine("    network.on('doubleClick', function(params) {");
        sb.AppendLine("      if (params.nodes.length > 0 && selectedNodeId === params.nodes[0]) {");
        sb.AppendLine("        const node = nodes.get(params.nodes[0]);");
        sb.AppendLine("        if (node.doc) { window.open(node.doc, '_blank'); }");
        sb.AppendLine("      }");
        sb.AppendLine("    });");

        sb.AppendLine("  </script>");
        sb.AppendLine("</body>");
        sb.AppendLine("</html>");

        File.WriteAllText(outputPath, sb.ToString());
    }

    private static string EscapeJs(string s) => s.Replace("\\", "\\\\").Replace("'", "\\'").Replace("\n", "\\n");
}
