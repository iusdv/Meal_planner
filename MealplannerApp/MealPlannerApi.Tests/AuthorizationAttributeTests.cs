using MealPlannerApi.Controllers;
using MealPlannerApi.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace MealPlannerApi.Tests;

public class AuthorizationAttributeTests
{
    [Fact(DisplayName = "Autorisatie - persoonlijke controllers vereisen een ingelogde user")]
    public void ProtectedControllers_RequireAuthenticatedUser()
    {
        AssertControllerRequiresAuthorization<ProfileController>();
        AssertControllerRequiresAuthorization<GoalsController>();
        AssertControllerRequiresAuthorization<MealsController>();
        AssertControllerRequiresAuthorization<IngredientsController>();
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

    [Fact(DisplayName = "Autorisatie - auth en suggesties hebben rate limiting")]
    public void SensitiveEndpoints_HaveRateLimiting()
    {
        AssertMethodHasRateLimit<AuthController>(nameof(AuthController.Register), RateLimitPolicyNames.Auth);
        AssertMethodHasRateLimit<AuthController>(nameof(AuthController.Login), RateLimitPolicyNames.Auth);
        AssertMethodHasRateLimit<SuggestionsController>(nameof(SuggestionsController.GetSuggestion), RateLimitPolicyNames.Suggestions);
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

    private static void AssertMethodHasRateLimit<TController>(string methodName, string policyName)
    {
        var method = typeof(TController).GetMethods()
            .Single(method => method.Name == methodName);
        var attribute = Assert.Single(method.GetCustomAttributes(typeof(EnableRateLimitingAttribute), inherit: true)
            .Cast<EnableRateLimitingAttribute>());

        Assert.Equal(policyName, attribute.PolicyName);
    }
}
