using Tomlyn;
using Tomlyn.Model;
using Purrject.Exceptions;

namespace Purrject.Services;

public record ModuleInfo(string Name, string Intro, string Document, List<string> Requirements, string Path);

public record ProjectInfo(string Name, Dictionary<string, ModuleInfo> Modules);

public class ConfigService
{
    private const string ConfigFileName = "purrject.toml";

    public string FindRootConfig(string startDir)
    {
        var dir = Path.GetFullPath(startDir);
        while (dir != null)
        {
            var configPath = Path.Combine(dir, ConfigFileName);
            if (File.Exists(configPath))
                return configPath;
            dir = Path.GetDirectoryName(dir);
        }
        throw new ConfigNotFoundException(startDir);
    }

    public ProjectInfo LoadProject(string configPath)
    {
        var content = File.ReadAllText(configPath);
        var model = Toml.ToModel(content);

        if (model["project"] is not TomlTable projectTable)
            throw new ConfigParseException(configPath, "Missing [project] section");
        var projectName = projectTable["project_name"]?.ToString() ?? "unnamed";

        var modules = new Dictionary<string, ModuleInfo>();
        var rootDir = Path.GetDirectoryName(configPath)!;

        if (model["modules"] is TomlTable modulesTable)
        {
            foreach (var (name, relPath) in modulesTable)
            {
                if (relPath is not string path) continue;
                var moduleConfigPath = Path.Combine(rootDir, path, ConfigFileName);
                if (!File.Exists(moduleConfigPath)) continue;

                var moduleInfo = LoadModule(moduleConfigPath, name);
                modules[name] = moduleInfo;
            }
        }

        return new ProjectInfo(projectName, modules);
    }

    public ModuleInfo LoadModule(string configPath, string name)
    {
        var content = File.ReadAllText(configPath);
        var model = Toml.ToModel(content);

        if (model["module"] is not TomlTable table)
            throw new ConfigParseException(configPath, "Missing [module] section");

        var intro = table["intro"]?.ToString() ?? "";
        var document = table["document"]?.ToString() ?? "";
        var requirements = new List<string>();

        if (table["requirements"] is TomlArray arr)
        {
            foreach (var item in arr)
                if (item is string s) requirements.Add(s);
        }

        var moduleDir = Path.GetDirectoryName(configPath)!;
        return new ModuleInfo(name, intro, document, requirements, moduleDir);
    }

    public void InitProject(string dir, string projectName)
    {
        var configPath = Path.Combine(dir, ConfigFileName);
        var content = $"[project]\nproject_name = \"{projectName}\"\n\n[modules]\n";
        File.WriteAllText(configPath, content);
    }

    public void AddModule(string rootDir, string name, string intro, string document, List<string> dependencies)
    {
        var moduleDir = Path.Combine(rootDir, "modules", name);
        Directory.CreateDirectory(moduleDir);

        var depsList = string.Join(", ", dependencies.Select(d => $"\"{d}\""));
        var configContent = $"""
            [module]
            module = "{name}"
            intro = "{intro}"
            document = "{document}"
            requirements = [{depsList}]

            """;
        File.WriteAllText(Path.Combine(moduleDir, ConfigFileName), configContent);

        // Update root config
        var rootConfigPath = Path.Combine(rootDir, ConfigFileName);
        var rootContent = File.ReadAllText(rootConfigPath);
        // Append module entry
        if (!rootContent.EndsWith('\n')) rootContent += "\n";
        rootContent += $"{name} = \"modules/{name}\"\n";
        File.WriteAllText(rootConfigPath, rootContent);
    }
}
