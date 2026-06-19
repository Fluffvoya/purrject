using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class DepsCommand
{
    public static Command Create()
    {
        var command = new Command("deps", "Show direct dependencies of a module");
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

                var module = project.Modules[moduleName];
                foreach (var dep in module.Requirements)
                {
                    Console.WriteLine(dep);
                }
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, moduleArg, dirOption);

        return command;
    }
}
