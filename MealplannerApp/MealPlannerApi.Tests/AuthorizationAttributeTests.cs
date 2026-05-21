using MealPlannerApi.Controllers;
using Microsoft.AspNetCore.Authorization;

namespace MealPlannerApi.Tests;

public class AuthorizationAttributeTests
{
    [Fact(DisplayName = "Autorisatie - persoonlijke controllers vereisen een ingelogde user")]
    public void ProtectedControllers_RequireAuthenticatedUser()
    {
        AssertControllerRequiresAuthorization<ProfileController>();
        AssertControllerRequiresAuthorization<GoalsController>();
        AssertControllerRequiresAuthorization<MealsController>();
        AssertControllerRequiresAuthorization<PlannedMealsController>();
        AssertControllerRequiresAuthorization<FavoritesController>();
        AssertControllerRequiresAuthorization<SuggestionsController>();
    }

    [Fact(DisplayName = "Autorisatie - admin controller vereist expliciet de Admin rol")]
    public void AdminController_RequiresAdminRole()
    {
        var attribute = Assert.Single(typeof(AdminController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>());

        Assert.Equal("Admin", attribute.Roles);
    }

    [Fact(DisplayName = "Autorisatie - maaltijden aanmaken en verwijderen vereisen de Admin rol")]
    public void MealWriteEndpoints_RequireAdminRole()
    {
        AssertMethodRequiresAdminRole<MealsController>(nameof(MealsController.Create));
        AssertMethodRequiresAdminRole<MealsController>(nameof(MealsController.Delete));
    }

    [Fact(DisplayName = "Autorisatie - auth controller blijft openbaar voor registreren en inloggen")]
    public void AuthController_DoesNotRequireExistingLogin()
    {
        Assert.Empty(typeof(AuthController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true));
    }

    private static void AssertControllerRequiresAuthorization<TController>()
    {
        Assert.NotEmpty(typeof(TController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true));
    }

    private static void AssertMethodRequiresAdminRole<TController>(string methodName)
    {
        var method = typeof(TController).GetMethods()
            .Single(method => method.Name == methodName);
        var attribute = Assert.Single(method.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>());

        Assert.Equal("Admin", attribute.Roles);
    }
}
