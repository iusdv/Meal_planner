using Microsoft.EntityFrameworkCore;
using MealPlannerApi.Models;

namespace MealPlannerApi.Data;

public class MealPlannerDbContext : DbContext
{
    public MealPlannerDbContext(DbContextOptions<MealPlannerDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Goal> Goals => Set<Goal>();
    public DbSet<Meal> Meals => Set<Meal>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<MealIngredient> MealIngredients => Set<MealIngredient>();
    public DbSet<NutritionalValue> NutritionalValues => Set<NutritionalValue>();
    public DbSet<PlannedMeal> PlannedMeals => Set<PlannedMeal>();
    public DbSet<Favorite> Favorites => Set<Favorite>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Naam).IsRequired().HasMaxLength(100);
            e.Property(u => u.Email).IsRequired().HasMaxLength(255);
            e.Property(u => u.WachtwoordHash).IsRequired();
            e.Property(u => u.Rol).IsRequired().HasMaxLength(50).HasDefaultValue("User");
        });

        // Profile
        modelBuilder.Entity<Profile>(e =>
        {
            e.HasKey(p => p.Id);
            e.HasOne(p => p.User)
             .WithOne(u => u.Profile)
             .HasForeignKey<Profile>(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Goal
        modelBuilder.Entity<Goal>(e =>
        {
            e.HasKey(g => g.Id);
            e.HasOne(g => g.User)
             .WithOne(u => u.Goal)
             .HasForeignKey<Goal>(g => g.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // Meal
        modelBuilder.Entity<Meal>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Naam).IsRequired().HasMaxLength(200);
            e.Property(m => m.Categorie).IsRequired().HasMaxLength(100);
        });

        // MealIngredient (composite key)
        modelBuilder.Entity<MealIngredient>(e =>
        {
            e.HasKey(mi => new { mi.MealId, mi.IngredientId });
            e.HasOne(mi => mi.Meal)
             .WithMany(m => m.MealIngredients)
             .HasForeignKey(mi => mi.MealId);
            e.HasOne(mi => mi.Ingredient)
             .WithMany(i => i.MealIngredients)
             .HasForeignKey(mi => mi.IngredientId);
        });

        // NutritionalValue
        modelBuilder.Entity<NutritionalValue>(e =>
        {
            e.HasKey(nv => nv.Id);
            e.HasOne(nv => nv.Ingredient)
             .WithOne(i => i.NutritionalValue)
             .HasForeignKey<NutritionalValue>(nv => nv.IngredientId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // PlannedMeal
        modelBuilder.Entity<PlannedMeal>(e =>
        {
            e.HasKey(pm => pm.Id);
            e.HasOne(pm => pm.User)
             .WithMany(u => u.PlannedMeals)
             .HasForeignKey(pm => pm.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pm => pm.Meal)
             .WithMany(m => m.PlannedMeals)
             .HasForeignKey(pm => pm.MealId);
            e.Property(pm => pm.Maaltijdtype)
             .IsRequired()
             .HasMaxLength(20);
        });

        // Favorite
        modelBuilder.Entity<Favorite>(e =>
        {
            e.HasKey(f => f.Id);
            e.HasIndex(f => new { f.UserId, f.MealId }).IsUnique();
            e.HasOne(f => f.User)
             .WithMany(u => u.Favorites)
             .HasForeignKey(f => f.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(f => f.Meal)
             .WithMany(m => m.Favorites)
             .HasForeignKey(f => f.MealId);
        });
    }
}
