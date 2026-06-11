using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class ShowCommand
{
    public static Command Create()
    {
        var command = new Command("show", "Show details of a specific module");
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

                if (!project.Modules.TryGetValue(moduleName, out var module))
                    throw new ModuleNotFoundException(moduleName);

                Console.WriteLine($"Module:    {module.Name}");
                Console.WriteLine($"Intro:     {module.Intro}");
                Console.WriteLine($"Document:  {module.Document}");
                Console.WriteLine($"Path:      {module.Path}");
                Console.WriteLine($"Depends on:");
                if (module.Requirements.Count == 0)
                {
                    Console.WriteLine("  (none)");
                }
                else
                {
                    foreach (var dep in module.Requirements)
                        Console.WriteLine($"  - {dep}");
                }

                // Show what depends on this module
                var dependents = project.Modules.Values
                    .Where(m => m.Requirements.Contains(moduleName))
                    .Select(m => m.Name)
                    .ToList();
                Console.WriteLine($"Depended by:");
                if (dependents.Count == 0)
                    Console.WriteLine("  (none)");
                else
                    foreach (var d in dependents)
                        Console.WriteLine($"  - {d}");
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, moduleArg, dirOption);

        return command;
    }
}
