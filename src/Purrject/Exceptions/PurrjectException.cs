namespace Purrject.Exceptions;

public class PurrjectException : Exception
{
    public PurrjectException(string message) : base(message) { }
    public PurrjectException(string message, Exception inner) : base(message, inner) { }
}

public class ConfigNotFoundException : PurrjectException
{
    public ConfigNotFoundException(string directory)
        : base($"No purrject.toml found in or above '{directory}'") { }
}

public class ConfigParseException : PurrjectException
{
    public ConfigParseException(string path, string reason)
        : base($"Failed to parse '{path}': {reason}") { }
}

public class ModuleNotFoundException : PurrjectException
{
    public ModuleNotFoundException(string name)
        : base($"Module '{name}' not found") { }
}
