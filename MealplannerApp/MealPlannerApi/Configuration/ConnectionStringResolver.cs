using System.Data.Common;
using Microsoft.Extensions.Configuration;

namespace MealPlannerApi.Configuration;

public static class ConnectionStringResolver
{
    public static string ResolveMySqlConnectionString(IConfiguration configuration)
    {
        var settings = ReadDatabaseSettings(configuration);

        if (HasAnyDatabaseEnvValue(settings))
        {
            var missingKeys = GetMissingDatabaseKeys(settings);
            if (missingKeys.Count > 0)
            {
                throw new InvalidOperationException(
                    $"Missing required database environment variables: {string.Join(", ", missingKeys)}");
            }
            return BuildMySqlConnectionString(settings);
        }

        return configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:DefaultConnection is not configured and no DATABASE_* environment variables were provided.");
    }

    private static DatabaseSettings ReadDatabaseSettings(IConfiguration configuration) => new(
        configuration["DATABASE_HOST"],
        configuration["DATABASE_PORT"],
        configuration["DATABASE_NAME"],
        configuration["DATABASE_USER"],
        configuration["DATABASE_PASSWORD"]);

    private static bool HasAnyDatabaseEnvValue(DatabaseSettings settings) =>
        !string.IsNullOrWhiteSpace(settings.Host) ||
        !string.IsNullOrWhiteSpace(settings.Port) ||
        !string.IsNullOrWhiteSpace(settings.Database) ||
        !string.IsNullOrWhiteSpace(settings.User) ||
        !string.IsNullOrWhiteSpace(settings.Password);

    private static List<string> GetMissingDatabaseKeys(DatabaseSettings settings)
    {
        var missingKeys = new List<string>();
        if (string.IsNullOrWhiteSpace(settings.Host)) missingKeys.Add("DATABASE_HOST");
        if (string.IsNullOrWhiteSpace(settings.Port)) missingKeys.Add("DATABASE_PORT");
        if (string.IsNullOrWhiteSpace(settings.Database)) missingKeys.Add("DATABASE_NAME");
        if (string.IsNullOrWhiteSpace(settings.User)) missingKeys.Add("DATABASE_USER");
        if (string.IsNullOrWhiteSpace(settings.Password)) missingKeys.Add("DATABASE_PASSWORD");
        return missingKeys;
    }

    private static string BuildMySqlConnectionString(DatabaseSettings settings)
    {
        if (!uint.TryParse(settings.Port, out var parsedPort))
        {
            throw new InvalidOperationException("DATABASE_PORT must be a valid unsigned integer.");
        }

        var builder = new DbConnectionStringBuilder
        {
            ["Server"] = settings.Host!,
            ["Port"] = parsedPort,
            ["Database"] = settings.Database!,
            ["User ID"] = settings.User!,
            ["Password"] = settings.Password!,
            ["SslMode"] = "Required"
        };

        return builder.ConnectionString;
    }

    private sealed record DatabaseSettings(
        string? Host,
        string? Port,
        string? Database,
        string? User,
        string? Password);
}