using MealPlannerApi.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MealPlannerApi.Data;

public class MealPlannerDbContextFactory : IDesignTimeDbContextFactory<MealPlannerDbContext>
{
    public MealPlannerDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        EnvFile.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddUserSecrets<MealPlannerDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
        var mySqlServerVersion = configuration["MySql:ServerVersion"] ?? "8.0.36";

        var optionsBuilder = new DbContextOptionsBuilder<MealPlannerDbContext>();
        optionsBuilder.UseMySql(connectionString, ServerVersion.Parse(mySqlServerVersion));

        return new MealPlannerDbContext(optionsBuilder.Options);
    }
}
