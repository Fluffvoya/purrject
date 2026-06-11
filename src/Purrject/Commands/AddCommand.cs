using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class AddCommand
{
    public static Command Create()
    {
        var command = new Command("add", "Add a new module to the project");
        var moduleArg = new Argument<string>("module-name", "Name of the module");
        var introOption = new Option<string>("-i", () => "", "Module introduction");
        var docOption = new Option<string>("--document", () => "", "Documentation path");
        var depsOption = new Option<string[]>("-r", "Dependencies (repeatable)") { Arity = ArgumentArity.ZeroOrMore };
        var dirOption = new Option<string>("-d", () => ".", "Project root directory");

        command.AddArgument(moduleArg);
        command.AddOption(introOption);
        command.AddOption(docOption);
        command.AddOption(depsOption);
        command.AddOption(dirOption);

        command.SetHandler((moduleName, intro, document, deps, dir) =>
        {
            try
            {
                var service = new ConfigService();
                var rootConfig = service.FindRootConfig(dir);
                var rootDir = Path.GetDirectoryName(rootConfig)!;

                service.AddModule(rootDir, moduleName, intro, document, deps.ToList());
                Console.WriteLine($"Added module '{moduleName}'");
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, moduleArg, introOption, docOption, depsOption, dirOption);

        return command;
    }
}
