using MealPlannerApi.Configuration;
using Microsoft.Extensions.Configuration;

namespace MealPlannerApi.Tests;

public class ConnectionStringResolverTests
{
    [Fact(DisplayName = "Configuratie - gebruikt DefaultConnection als er geen DATABASE variabelen zijn")]
    public void ResolveMySqlConnectionString_UsesDefaultConnectionWhenNoDatabaseEnvironmentValuesExist()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Server=localhost;Database=mealplanner;"
            })
            .Build();

        var connectionString = ConnectionStringResolver.ResolveMySqlConnectionString(configuration);

        Assert.Equal("Server=localhost;Database=mealplanner;", connectionString);
    }

    [Fact(DisplayName = "Configuratie - incomplete DATABASE variabelen geven duidelijke foutmelding")]
    public void ResolveMySqlConnectionString_RequiresCompleteDatabaseEnvironmentValues()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DATABASE_HOST"] = "db.example.test"
            })
            .Build();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ConnectionStringResolver.ResolveMySqlConnectionString(configuration));

        Assert.Contains("DATABASE_PORT", exception.Message);
        Assert.Contains("DATABASE_NAME", exception.Message);
    }

    [Fact(DisplayName = "Configuratie - complete DATABASE variabelen bouwen een MySQL connection string")]
    public void ResolveMySqlConnectionString_BuildsConnectionStringFromDatabaseEnvironmentValues()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DATABASE_HOST"] = "db.example.test",
                ["DATABASE_PORT"] = "3306",
                ["DATABASE_NAME"] = "mealplanner",
                ["DATABASE_USER"] = "meal_user",
                ["DATABASE_PASSWORD"] = "secret"
            })
            .Build();

        var connectionString = ConnectionStringResolver.ResolveMySqlConnectionString(configuration);

        Assert.Contains("Server=db.example.test", connectionString);
        Assert.Contains("Port=3306", connectionString);
        Assert.Contains("Database=mealplanner", connectionString);
        Assert.Contains("User ID=meal_user", connectionString);
        Assert.Contains("SslMode=Required", connectionString);
    }
}
