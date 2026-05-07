using System.Security.Claims;
using MealPlannerApi.DTOs;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MealPlannerApi.Controllers;

[ApiController]
[Route("api/[controller]")]
// Threat ID: TM-02
// Mitigatie tegen unauthorized API access: alleen geauthenticeerde gebruikers
// met een geldige JWT mogen deze endpoint aanroepen.
[Authorize]
public class SuggestionsController : ControllerBase
{
    private readonly SuggestionsService _suggestionsService;

    public SuggestionsController(SuggestionsService suggestionsService)
    {
        _suggestionsService = suggestionsService;
    }

    [HttpPost]
    public async Task<IActionResult> GetSuggestion([FromBody] SuggestionRequestDto dto)
    {
        //TODO ratelimiting toevoegen tegen spam.
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var answer = await _suggestionsService.GetSuggestionAsync(userId, dto.Vraag);
        return Ok(new SuggestionResponseDto(answer));
    }
}
