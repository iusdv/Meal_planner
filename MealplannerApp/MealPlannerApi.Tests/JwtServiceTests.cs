using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
using MealPlannerApi.Tests.Support;

namespace MealPlannerApi.Tests;

public class JwtServiceTests
{
    [Fact(DisplayName = "JWT - token bevat user id, email, naam, rol, issuer en audience")]
    public void GenerateToken_IncludesUserIdentityAndRoleClaims()
    {
        var service = new JwtService(ControllerTestContext.JwtConfiguration());

        var token = service.GenerateToken(new User
        {
            Id = 42,
            Naam = "Ius",
            Email = "ius@example.test",
            Rol = "Admin"
        });

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("MealPlanner.Tests", jwt.Issuer);
        Assert.Contains(jwt.Audiences, audience => audience == "MealPlanner.Tests");
        Assert.Contains(jwt.Claims, claim => claim.Type == ClaimTypes.NameIdentifier && claim.Value == "42");
        Assert.Contains(jwt.Claims, claim => claim.Type == ClaimTypes.Email && claim.Value == "ius@example.test");
        Assert.Contains(jwt.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == "Admin");
    }
}
