using System.Text;
using System.Text.Json;

namespace Purrject.Services;

public class GraphService
{
    public void GenerateGraph(ProjectInfo project, string outputPath)
    {
        // Serialize module names as data. The default encoder escapes '<' as well,
        // so a description cannot close the embedded script element.
        var edges = project.Modules
            .SelectMany(module => module.Value.Requirements.Distinct(StringComparer.Ordinal)
                .Select(dependency => new { from = module.Key, to = dependency }))
            .ToArray();
        var names = project.Modules.Keys.Concat(edges.Select(edge => edge.to))
            .Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal);
        var nodes = names.Select(name =>
        {
            project.Modules.TryGetValue(name, out var module);
            return new
            {
                id = name,
                intro = module?.Intro ?? "This dependency has no module configuration in this project.",
                document = module is not null && !string.IsNullOrWhiteSpace(module.Document)
                    ? new Uri(Path.GetFullPath(Path.Combine(module.Path, module.Document))).AbsoluteUri
                    : "",
                external = module is null
            };
        }).ToArray();

        var html = ReadResource("graph.html")
            .Replace("/*__GRAPH_STYLES__*/", ReadResource("graph.css"), StringComparison.Ordinal)
            .Replace("/*__GRAPH_SCRIPT__*/", ReadResource("graph.js"), StringComparison.Ordinal)
            .Replace("__GRAPH_DATA__", JsonSerializer.Serialize(new { name = project.Name, nodes, edges }),
                StringComparison.Ordinal);

        File.WriteAllText(outputPath, html, new UTF8Encoding(false));
    }

    private static string ReadResource(string name)
    {
        using var stream = typeof(GraphService).Assembly.GetManifestResourceStream($"Purrject.Graph.{name}")
            ?? throw new InvalidOperationException($"Missing graph template resource: {name}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
