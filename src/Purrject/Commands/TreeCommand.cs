using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class TreeCommand
{
    public static Command Create()
    {
        var command = new Command("tree", "Show the full project dependency tree");
        var dirOption = new Option<string>("-d", () => ".", "Project root directory");
        command.AddOption(dirOption);

        command.SetHandler((dir) =>
        {
            try
            {
                var service = new ConfigService();
                var rootConfig = service.FindRootConfig(dir);
                var project = service.LoadProject(rootConfig);

                if (project.Modules.Count == 0)
                {
                    Console.WriteLine("No modules found.");
                    return;
                }

                Console.WriteLine($"{project.Name}");

                // Find root modules (not depended upon by others)
                var allDeps = project.Modules.Values
                    .SelectMany(m => m.Requirements)
                    .ToHashSet();
                var rootModules = project.Modules.Keys
                    .Where(k => !allDeps.Contains(k))
                    .OrderBy(k => k)
                    .ToList();

                // If all modules are in a cycle, just show them all
                if (rootModules.Count == 0)
                    rootModules = project.Modules.Keys.OrderBy(k => k).ToList();

                for (int i = 0; i < rootModules.Count; i++)
                {
                    var name = rootModules[i];
                    var isLast = i == rootModules.Count - 1;
                    var connector = isLast ? "└── " : "├── ";
                    var indent = isLast ? "    " : "│   ";

                    Console.WriteLine($"{connector}{name}");
                    var path = new HashSet<string> { name };
                    PrintTree(project, name, indent, path);
                }
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, dirOption);

        return command;
    }

    private static void PrintTree(ProjectInfo project, string moduleName, string indent, HashSet<string> path)
    {
        if (!project.Modules.TryGetValue(moduleName, out var module)) return;

        for (int i = 0; i < module.Requirements.Count; i++)
        {
            var dep = module.Requirements[i];
            var isLast = i == module.Requirements.Count - 1;
            var connector = isLast ? "└── " : "├── ";
            var nextIndent = indent + (isLast ? "    " : "│   ");

            if (path.Contains(dep))
            {
                Console.WriteLine($"{indent}{connector}{dep} (cycle)");
                continue;
            }

            Console.WriteLine($"{indent}{connector}{dep}");
            path.Add(dep);
            PrintTree(project, dep, nextIndent, path);
            path.Remove(dep);
        }
    }
}
