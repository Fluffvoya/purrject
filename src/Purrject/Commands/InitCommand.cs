using System.CommandLine;
using Purrject.Services;

namespace Purrject.Commands;

public class InitCommand
{
    public static Command Create()
    {
        var command = new Command("init", "Initialize a new purrject project");

        var nameOption = new Option<string>("-n", "Project name") { IsRequired = true };
        var dirOption = new Option<string>("-d", () => ".", "Project directory");

        command.AddOption(nameOption);
        command.AddOption(dirOption);

        command.SetHandler((name, dir) =>
        {
            var service = new ConfigService();
            var targetDir = Path.GetFullPath(dir);
            Directory.CreateDirectory(targetDir);

            var configPath = Path.Combine(targetDir, "purrject.toml");
            if (File.Exists(configPath))
            {
                Console.WriteLine($"Error: purrject.toml already exists in '{targetDir}'");
                return;
            }

            service.InitProject(targetDir, name);
            Console.WriteLine($"Initialized project '{name}' in '{targetDir}'");
        }, nameOption, dirOption);

        return command;
    }
}
