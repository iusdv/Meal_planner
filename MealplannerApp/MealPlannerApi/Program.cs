using System.Text;
using MealPlannerApi.Data;
using MealPlannerApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ── Database (MySQL via Pomelo EF Core) ──────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<MealPlannerDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddHttpClient("Gemini");
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<SuggestionsService>();

builder.Services.AddControllers();

// ── Suppress detailed error information in production (Information Disclosure) ─
// Stack traces and exception details are only shown in Development environment.
// In production the default exception handler returns generic 500 responses.

var app = builder.Build();

// ── Auto-apply migrations + seed data ────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MealPlannerDbContext>();
    db.Database.Migrate();
    SeedData.Initialize(db);
}

// ── Middleware pipeline ────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    // Detailed error pages only in Development – never in Production
    app.UseDeveloperExceptionPage();
}
else
{
    // Generic error handler prevents stack-trace/internal-detail leakage (Information Disclosure mitigation)
    app.UseExceptionHandler("/error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Generic error endpoint (production) – returns no internal details
app.Map("/error", () => Results.Problem("An unexpected error occurred.", statusCode: 500));

app.Run();
