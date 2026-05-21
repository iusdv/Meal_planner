using MealPlannerApi.Configuration;
using MealPlannerApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Data.Common;

namespace MealPlannerApi.Tests;

public class MySqlDatabaseIntegrationTests
{
    [Fact(DisplayName = "Database integratie - MySQL database is bereikbaar")]
    public async Task ConfiguredMySqlDatabase_CanConnect()
    {
        await using var db = CreateConfiguredMySqlContext();

        var canConnect = await db.Database.CanConnectAsync();

        Assert.True(canConnect, "De MySQL database is niet bereikbaar");
    }

    [Fact(DisplayName = "Database integratie - MySQL database bevat de verwachte MealPlanner tabellen")]
    public async Task ConfiguredMySqlDatabase_HasExpectedMealPlannerSchema()
    {
        await using var db = CreateConfiguredMySqlContext();

        var canConnect = await db.Database.CanConnectAsync();
        Assert.True(canConnect, "De MySQL database is niet bereikbaar, waardoor het schema niet gecontroleerd kan worden.");

        _ = await db.Users.AsNoTracking().Take(1).ToListAsync();
        _ = await db.Profiles.AsNoTracking().Take(1).ToListAsync();
        _ = await db.Goals.AsNoTracking().Take(1).ToListAsync();
        _ = await db.Meals.AsNoTracking().Take(1).ToListAsync();
        _ = await db.Ingredients.AsNoTracking().Take(1).ToListAsync();
        _ = await db.PlannedMeals.AsNoTracking().Take(1).ToListAsync();
        _ = await db.Favorites.AsNoTracking().Take(1).ToListAsync();

        Assert.True(true);
    }

    private static MealPlannerDbContext CreateConfiguredMySqlContext()
    {
        var configuration = LoadApiConfiguration();
        var connectionString = WithShortConnectionTimeout(
            ConnectionStringResolver.ResolveMySqlConnectionString(configuration));

        if (connectionString.Contains("YOUR_DB_PASSWORD", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "De database-integratietest gebruikt nog de placeholder YOUR_DB_PASSWORD. Vul de databasegegevens in via .env of environment variables.");
        }

        var serverVersion = configuration["MySql:ServerVersion"] ?? "8.0.36";
        var options = new DbContextOptionsBuilder<MealPlannerDbContext>()
            .UseMySql(connectionString, ServerVersion.Parse(serverVersion))
            .Options;

        return new MealPlannerDbContext(options);
    }

    private static string WithShortConnectionTimeout(string connectionString)
    {
        var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
        if (!builder.ContainsKey("Connection Timeout"))
        {
            builder["Connection Timeout"] = 5;
        }

        return builder.ConnectionString;
    }

    private static IConfiguration LoadApiConfiguration()
    {
        var apiDirectory = FindApiProjectDirectory();
        EnvFile.Load(Path.Combine(apiDirectory, ".env"));

        return new ConfigurationBuilder()
            .SetBasePath(apiDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();
    }

    private static string FindApiProjectDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            var candidate = Path.Combine(current.FullName, "MealplannerApp", "MealPlannerApi");
            if (File.Exists(Path.Combine(candidate, "MealPlannerApi.csproj")))
            {
                return candidate;
            }

            if (File.Exists(Path.Combine(current.FullName, "MealPlannerApi.csproj")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("MealPlannerApi projectmap kon niet worden gevonden voor de database-integratietests.");
    }
}
