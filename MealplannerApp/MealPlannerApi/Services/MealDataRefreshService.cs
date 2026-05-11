using MealPlannerApi.Data;
using Microsoft.EntityFrameworkCore;

namespace MealPlannerApi.Services;

public class MealDataRefreshService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MealDataRefreshService> _logger;

    public MealDataRefreshService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<MealDataRefreshService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_configuration.GetValue("MealDataRefresh:Enabled", true))
        {
            return;
        }

        var initialDelay = TimeSpan.FromMinutes(_configuration.GetValue("MealDataRefresh:InitialDelayMinutes", 10));
        var interval = TimeSpan.FromDays(_configuration.GetValue("MealDataRefresh:IntervalDays", 7));

        try
        {
            await Task.Delay(initialDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            await RefreshMealDataAsync(stoppingToken);

            try
            {
                await Task.Delay(interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task RefreshMealDataAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MealPlannerDbContext>();
        var mealDbService = scope.ServiceProvider.GetRequiredService<TheMealDbService>();
        var foodDataService = scope.ServiceProvider.GetRequiredService<FoodDataCentralService>();

        var mealsPerCategory = Math.Clamp(_configuration.GetValue("MealDataRefresh:MealsPerCategory", 8), 1, 50);
        var minimumCatalogSize = Math.Clamp(_configuration.GetValue("MealDataRefresh:MinimumCatalogSize", 180), 1, 1000);
        var enrichLimit = Math.Clamp(_configuration.GetValue("MealDataRefresh:EnrichLimit", 100), 1, 500);

        try
        {
            await mealDbService.ImportStarterMealsAsync(mealsPerCategory, minimumCatalogSize, cancellationToken);

            var meals = await db.Meals
                .Include(meal => meal.MealIngredients)
                    .ThenInclude(mealIngredient => mealIngredient.Ingredient)
                        .ThenInclude(ingredient => ingredient.NutritionalValue)
                .Where(meal => meal.ExternalMealDbId != null)
                .OrderBy(meal => meal.Id)
                .Take(enrichLimit)
                .ToListAsync(cancellationToken);

            var enriched = 0;
            foreach (var meal in meals)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (await mealDbService.EnrichMealDetailsAsync(meal, cancellationToken))
                {
                    await db.SaveChangesAsync(cancellationToken);
                }

                if (await foodDataService.BuildNutritionFactsAsync(meal, cancellationToken) != null)
                {
                    enriched++;
                }
            }

            _logger.LogInformation("Weekly meal data refresh completed. Enriched {Count} meals.", enriched);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Weekly meal data refresh failed.");
        }
    }
}
