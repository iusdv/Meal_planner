using System.Security.Claims;
using MealPlannerApi.Data;
using MealPlannerApi.DTOs;
using MealPlannerApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public ProfileController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        return profile == null ? NotFound() : Ok(new ProfileDto(
            profile.Id, profile.UserId, profile.Gender,
            profile.Leeftijd, profile.Gewicht, profile.Activiteit));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertProfileDto dto)
    {
        var userId = GetUserId();
        var profile = await _db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile == null)
        {
            profile = new Profile { UserId = userId };
            _db.Profiles.Add(profile);
        }
        profile.Gender = dto.Gender;
        profile.Leeftijd = dto.Leeftijd;
        profile.Gewicht = dto.Gewicht;
        profile.Activiteit = dto.Activiteit;
        await _db.SaveChangesAsync();
        return Ok(new ProfileDto(profile.Id, profile.UserId, profile.Gender,
            profile.Leeftijd, profile.Gewicht, profile.Activiteit));
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GoalsController : ControllerBase
{
    private readonly MealPlannerDbContext _db;

    public GoalsController(MealPlannerDbContext db) => _db = db;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.UserId == userId);
        return goal == null ? NotFound() : Ok(new GoalDto(
            goal.Id, goal.UserId, goal.Caloriedoel,
            goal.Eiwitdoel, goal.Koolhydraatdoel, goal.Vetdoel));
    }

    [HttpPut]
    public async Task<IActionResult> Upsert([FromBody] UpsertGoalDto dto)
    {
        var userId = GetUserId();
        var goal = await _db.Goals.FirstOrDefaultAsync(g => g.UserId == userId);
        if (goal == null)
        {
            goal = new Goal { UserId = userId };
            _db.Goals.Add(goal);
        }
        goal.Caloriedoel = dto.Caloriedoel;
        goal.Eiwitdoel = dto.Eiwitdoel;
        goal.Koolhydraatdoel = dto.Koolhydraatdoel;
        goal.Vetdoel = dto.Vetdoel;
        await _db.SaveChangesAsync();
        return Ok(new GoalDto(goal.Id, goal.UserId, goal.Caloriedoel,
            goal.Eiwitdoel, goal.Koolhydraatdoel, goal.Vetdoel));
    }
}
