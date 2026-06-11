using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class DepsCommand
{
    public static Command Create()
    {
        var command = new Command("deps", "Show recursive dependencies of a module");
        var moduleArg = new Argument<string>("module-name", "Name of the module");
        var dirOption = new Option<string>("-d", () => ".", "Project root directory");

        command.AddArgument(moduleArg);
        command.AddOption(dirOption);

        command.SetHandler((moduleName, dir) =>
        {
            try
            {
                var service = new ConfigService();
                var rootConfig = service.FindRootConfig(dir);
                var project = service.LoadProject(rootConfig);

                if (!project.Modules.ContainsKey(moduleName))
                    throw new ModuleNotFoundException(moduleName);

                Console.WriteLine($"{moduleName}");
                var path = new HashSet<string> { moduleName };
                PrintDeps(project, moduleName, "  ", path);
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, moduleArg, dirOption);

        return command;
    }

    private static void PrintDeps(ProjectInfo project, string moduleName, string indent, HashSet<string> path)
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
            PrintDeps(project, dep, nextIndent, path);
            path.Remove(dep);
        }
    }
}
