using System.CommandLine;
using Purrject.Commands;

var rootCommand = new RootCommand("purrject - Analyze project module structures")
{
    InitCommand.Create(),
    AddCommand.Create(),
    ListCommand.Create(),
    ShowCommand.Create(),
    DepsCommand.Create(),
    TreeCommand.Create(),
    GraphCommand.Create(),
};

return await rootCommand.InvokeAsync(args);
