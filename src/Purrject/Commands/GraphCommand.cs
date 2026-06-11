using System.CommandLine;
using Purrject.Services;
using Purrject.Exceptions;

namespace Purrject.Commands;

public class GraphCommand
{
    public static Command Create()
    {
        var command = new Command("graph", "Generate an interactive HTML dependency graph");
        var outputOption = new Option<string>("-o", "Output file path");
        var dirOption = new Option<string>("-d", () => ".", "Project root directory");

        command.AddOption(outputOption);
        command.AddOption(dirOption);

        command.SetHandler((output, dir) =>
        {
            try
            {
                var service = new ConfigService();
                var rootConfig = service.FindRootConfig(dir);
                var project = service.LoadProject(rootConfig);

                var outputPath = output ?? Path.Combine(Path.GetDirectoryName(rootConfig)!, "purrject_graph.html");
                var graphService = new GraphService();
                graphService.GenerateGraph(project, outputPath);

                Console.WriteLine($"Graph generated: {outputPath}");
            }
            catch (PurrjectException ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }, outputOption, dirOption);

        return command;
    }
}
