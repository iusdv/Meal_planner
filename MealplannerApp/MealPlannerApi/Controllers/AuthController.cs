using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly MealPlannerDbContext _db;
    private readonly JwtService _jwtService;

    public AuthController(MealPlannerDbContext db, JwtService jwtService)
    {
        _db = db;
        _jwtService = jwtService;
    }

    /// <summary>
    /// Register a new user. The plain-text password is hashed with BCrypt
    /// before storage. The hash is NEVER returned to the client (DTO excludes it).
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
            return Conflict(new { message = "E-mailadres is al in gebruik." });

        var user = new User
        {
            Naam = dto.Naam,
            Email = dto.Email,
            // BCrypt.HashPassword includes a random salt – plain text is never stored
            WachtwoordHash = BCrypt.Net.BCrypt.HashPassword(dto.Wachtwoord),
            Rol = "User"
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user);
        return Ok(new AuthResponseDto(token, new UserDto(user.Id, user.Naam, user.Email, user.Rol)));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        // Use constant-time BCrypt.Verify to prevent timing attacks
        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Wachtwoord, user.WachtwoordHash))
            return Unauthorized(new { message = "Ongeldig e-mailadres of wachtwoord." });

        var token = _jwtService.GenerateToken(user);
        return Ok(new AuthResponseDto(token, new UserDto(user.Id, user.Naam, user.Email, user.Rol)));
    }
}
