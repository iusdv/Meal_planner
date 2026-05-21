using MealPlannerApi.DTOs;
using MealPlannerApi.Tests.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Tests;

public class AuthControllerTests
{
    [Fact(DisplayName = "Auth - registreren maakt een user aan, hasht het wachtwoord en retourneert een JWT")]
    public async Task Register_CreatesUserWithHashedPasswordAndReturnsToken()
    {
        using var database = TestDatabase.Create();
        var controller = ControllerTestContext.CreateAuthController(database.Db);

        var result = await controller.Register(new RegisterDto("Ius", "ius@example.test", "secret123"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponseDto>(ok.Value);
        var user = await database.Db.Users.SingleAsync();

        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal("Ius", response.User.Naam);
        Assert.Equal("User", response.User.Rol);
        Assert.NotEqual("secret123", user.WachtwoordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("secret123", user.WachtwoordHash));
    }

    [Fact(DisplayName = "Auth - registreren weigert een e-mailadres dat al bestaat")]
    public async Task Register_RejectsDuplicateEmail()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db, email: "ius@example.test");
        var controller = ControllerTestContext.CreateAuthController(database.Db);

        var result = await controller.Register(new RegisterDto("Ius", "ius@example.test", "secret123"));

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact(DisplayName = "Auth - login weigert een verkeerd wachtwoord en accepteert een correct wachtwoord")]
    public async Task Login_RejectsInvalidPasswordAndAcceptsValidPassword()
    {
        using var database = TestDatabase.Create();
        ControllerTestContext.AddUser(database.Db, email: "ius@example.test");
        var controller = ControllerTestContext.CreateAuthController(database.Db);

        var invalid = await controller.Login(new LoginDto("ius@example.test", "wrong-password"));
        var valid = await controller.Login(new LoginDto("ius@example.test", "secret123"));

        Assert.IsType<UnauthorizedObjectResult>(invalid);
        var ok = Assert.IsType<OkObjectResult>(valid);
        var response = Assert.IsType<AuthResponseDto>(ok.Value);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }
}
