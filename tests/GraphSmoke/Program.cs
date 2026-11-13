using System.Text.Json;
using System.Text.RegularExpressions;
using Purrject.Services;

var output = Path.GetFullPath(args.FirstOrDefault() ?? Path.Combine(Path.GetTempPath(), "purrject-graph-tests"));
Directory.CreateDirectory(output);
var service = new GraphService();

JsonElement Generate(string filename, ProjectInfo project)
{
    var path = Path.Combine(output, filename);
    service.GenerateGraph(project, path);
    var html = File.ReadAllText(path);
    Check(!html.Contains("/*__GRAPH_"), "All resources must be embedded");
    Check(!html.Contains("<script src="), "Graph must not require a CDN");
    Check(Regex.Matches(html, "<script(?: |>)").Count == 2, "Input must not inject script elements");
    var match = Regex.Match(html, "<script id=\"graph-data\" type=\"application/json\">(.*?)</script>", RegexOptions.Singleline);
    Check(match.Success, "Embedded graph data is present");
    using var document = JsonDocument.Parse(match.Groups[1].Value);
    return document.RootElement.Clone();
}

void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}

var empty = Generate("empty.html", new ProjectInfo("Empty project", new()));
Check(empty.GetProperty("nodes").GetArrayLength() == 0, "Empty graphs have no nodes");

const string unusual = "模块 '\" \\ </script><script>globalThis.injected = true</script>\n& __GRAPH_DATA__";
var special = Generate("special.html", new ProjectInfo(unusual, new()
{
    [unusual] = new(unusual, unusual, "doc with spaces #1.md", [], output)
}));
var specialNode = special.GetProperty("nodes")[0];
Check(special.GetProperty("name").GetString() == unusual, "Project names round trip safely");
Check(specialNode.GetProperty("id").GetString() == unusual, "Module names round trip safely");
Check(specialNode.GetProperty("intro").GetString() == unusual, "Descriptions round trip safely");
Check(specialNode.GetProperty("document").GetString()!.EndsWith("doc%20with%20spaces%20%231.md"), "Document URLs are encoded");

var relations = Generate("relations.html", new ProjectInfo("Relationship cases", new()
{
    ["a"] = new("a", "Depends on b, itself, and an unconfigured module", "", ["b", "b", "a", "missing"], output),
    ["b"] = new("b", "Reciprocal dependency", "", ["a"], output),
    ["isolated"] = new("isolated", "No connections", "", [], output)
}));
Check(relations.GetProperty("nodes").GetArrayLength() == 4, "Unconfigured dependencies are included");
Check(relations.GetProperty("edges").GetArrayLength() == 4, "Duplicate requirements are collapsed");
Check(relations.GetProperty("nodes").EnumerateArray().Single(node => node.GetProperty("id").GetString() == "missing")
    .GetProperty("external").GetBoolean(), "Unconfigured dependencies are marked external");

var modules = new Dictionary<string, ModuleInfo>();
for (var index = 0; index < 180; index++)
{
    var id = $"module-{index:000}";
    modules[id] = new(id, $"Module {index}", "", index > 0 ? [$"module-{(index - 1) / 2:000}"] : [], output);
}
Generate("large.html", new ProjectInfo("Larger map", modules));

var config = new ConfigService();
var example = config.LoadProject(Path.GetFullPath("example/purrject.toml"));
Generate("example.html", example);
Console.WriteLine($"Graph generation checks passed. Browser fixtures: {output}");
