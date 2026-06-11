using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class ListCommand
{
    public static Command Create()
    {
        var command = new Command("list", "List all modules in the project");
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

                // Table header
                var nameWidth = Math.Max(12, project.Modules.Keys.Max(k => k.Length) + 2);
                var introWidth = 50;

                Console.WriteLine($"{"Module".PadRight(nameWidth)} {"Description".PadRight(introWidth)}");
                Console.WriteLine(new string('-', nameWidth) + " " + new string('-', introWidth));

                foreach (var (name, module) in project.Modules.OrderBy(m => m.Key))
                {
                    var intro = module.Intro.Length > introWidth
                        ? module.Intro[..(introWidth - 3)] + "..."
                        : module.Intro;
                    Console.WriteLine($"{name.PadRight(nameWidth)} {intro}");
                }

                Console.WriteLine($"\nTotal: {project.Modules.Count} module(s)");
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, dirOption);

        return command;
    }
}
