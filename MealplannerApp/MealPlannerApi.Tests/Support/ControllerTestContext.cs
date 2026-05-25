using System.Security.Claims;
using MealPlannerApi.Controllers;
using MealPlannerApi.Data;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace MealPlannerApi.Tests.Support;

public sealed class TestDatabase : IDisposable
{
    private readonly SqliteConnection _connection;

    private TestDatabase(SqliteConnection connection, MealPlannerDbContext db)
    {
        _connection = connection;
        Db = db;
    }

    public MealPlannerDbContext Db { get; }

    public static TestDatabase Create()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<MealPlannerDbContext>()
            .UseSqlite(connection)
            .Options;

        var db = new MealPlannerDbContext(options);
        db.Database.EnsureCreated();

        return new TestDatabase(connection, db);
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}

public static class ControllerTestContext
{
    public static void SetUser(ControllerBase controller, int userId, string role = "User")
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, $"user{userId}@example.test"),
            new(ClaimTypes.Name, $"User {userId}"),
            new(ClaimTypes.Role, role)
        };

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };
    }

    public static IConfiguration JwtConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "this-is-a-test-key-with-more-than-32-bytes",
                ["Jwt:Issuer"] = "MealPlanner.Tests",
                ["Jwt:Audience"] = "MealPlanner.Tests",
                ["Jwt:ExpiresHours"] = "8"
            })
            .Build();

    public static User AddUser(MealPlannerDbContext db, int id = 1, string email = "user@example.test", string role = "User")
    {
        var user = new User
        {
            Id = id,
            Naam = $"User {id}",
            Email = email,
            WachtwoordHash = BCrypt.Net.BCrypt.HashPassword("secret123"),
            Rol = role
        };

        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    public static Meal AddMeal(MealPlannerDbContext db, int id, string name, string category = "Diner", bool isZelfgemaakt = false)
    {
        var meal = new Meal
        {
            Id = id,
            Naam = name,
            Beschrijving = $"{name} description",
            Instructies = $"{name} instructions",
            Categorie = category,
            Bereidingstijd = 20,
            Porties = 1,
            DieetLabels = "Anything",
            IsZelfgemaakt = isZelfgemaakt
        };

        db.Meals.Add(meal);
        db.SaveChanges();
        return meal;
    }

    public static AuthController CreateAuthController(MealPlannerDbContext db) =>
        new(db, new JwtService(JwtConfiguration()));

    public static IngredientsController CreateIngredientsController(MealPlannerDbContext db) =>
        new(db);

    public static MealsController CreateMealsController(MealPlannerDbContext db)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FoodDataCentral:ApiKey"] = "test"
            })
            .Build();

        return new MealsController(
            db,
            new TheMealDbService(db, new HttpClient(), NullLogger<TheMealDbService>.Instance),
            new FoodDataCentralService(db, new HttpClient(), configuration, NullLogger<FoodDataCentralService>.Instance),
            NullLogger<MealsController>.Instance);
    }
}
