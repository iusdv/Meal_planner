# 🥗 MealPlanner Webapp

Een full-stack maaltijdplanner showcaseproject gebouwd met **ASP.NET Core 10 Web API** (backend) en **React + Vite + TypeScript + Tailwind CSS** (frontend).

---

## 📁 Projectstructuur

```
MealplannerApp/
├── MealPlannerApi/          # ASP.NET Core Web API (backend)
│   ├── Controllers/         # Auth, Meals, PlannedMeals, Favorites, Profile, Goals, Admin, Suggestions
│   ├── Data/                # DbContext + SeedData
│   ├── DTOs/                # Data Transfer Objects
│   ├── Models/              # EF Core entiteiten
│   ├── Services/            # JwtService, SuggestionsService (MCP)
│   └── Program.cs           # App configuratie: CORS, JWT, EF Core, DI
└── frontend/                # React + Vite + TypeScript + Tailwind CSS
    └── src/
        ├── components/      # Navbar, ProtectedRoute, AIAssistant
        ├── context/         # AuthContext (JWT-state)
        ├── pages/           # Login, Register, Dashboard, Meals, Favorites, Profile, Admin
        ├── services/        # API-laag (axios)
        └── types/           # TypeScript interfaces
```

---

## 🚀 Installatie & Opstarten

### Vereisten

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- MySQL Server

### Backend

```bash
cd MealplannerApp/MealPlannerApi

# Pas de connection string aan in appsettings.json
# Server=localhost;Port=3306;Database=mealplanner;User=root;Password=yourpassword;

# Stel een veilige JWT-sleutel in (min. 32 tekens)
# appsettings.json → Jwt:Key

# Run (migrations + seed worden automatisch uitgevoerd bij start)
dotnet run
```

API draait op: `http://localhost:5000`

### Frontend

```bash
cd MealplannerApp/frontend
npm install
npm run dev
```

Frontend draait op: `http://localhost:5173`

---

## 🗄️ Database Schema

| Tabel              | Beschrijving                                                |
|--------------------|-------------------------------------------------------------|
| Users              | id, naam, email, wachtwoord_hash, rol                       |
| Profiles           | id, user_id, gender, leeftijd, gewicht, activiteit          |
| Goals              | id, user_id, caloriedoel, eiwitdoel, koolhydraatdoel, vetdoel |
| Meals              | id, naam, beschrijving, categorie, bereidingstijd, afbeelding_url |
| Ingredients        | id, naam, eenheid                                           |
| MealIngredients    | meal_id, ingredient_id, hoeveelheid (koppeltabel)           |
| NutritionalValues  | id, ingredient_id, kcal, eiwit, koolhydraat, vet            |
| PlannedMeals       | id, user_id, meal_id, datum, maaltijdtype                   |
| Favorites          | id, user_id, meal_id, datum_toegevoegd                      |

---

## 🔐 Beveiliging

### JWT Authenticatie

- Tokens worden gegenereerd in `Services/JwtService.cs` met HMAC-SHA256 signing.
- Tokens bevatten: `NameIdentifier`, `Email`, `Name`, `Role` claims.
- Verlooptijd: 8 uur.
- Frontend slaat het token op in `localStorage` en stuurt het mee als `Authorization: Bearer <token>` header via een axios interceptor (`services/api.ts`).

### BCrypt Wachtwoord-hashing

- Wachtwoorden worden **nooit** in plain text opgeslagen.
- `BCrypt.Net.BCrypt.HashPassword(wachtwoord)` genereert een hash met ingebouwde random salt.
- Verificatie: `BCrypt.Net.BCrypt.Verify(wachtwoord, hash)` (constant-time, beschermt tegen timing-aanvallen).
- Zie: `Controllers/AuthController.cs` regels 37–41 (registratie) en 51–52 (login).

### Role-Based Access Control (RBAC)

- Twee rollen: `User` en `Admin`.
- Admin-endpoints zijn beveiligd met `[Authorize(Roles = "Admin")]`.
- Zie: `Controllers/AdminController.cs` (klasse-niveau attribuut op regel 14) en `Controllers/MealsController.cs` (POST/DELETE op regels 51, 62).
- Frontend redirect niet-admins automatisch via `ProtectedRoute.tsx`.

---

## Information Disclosure

> *Information Disclosure* treedt op wanneer een applicatie onbedoeld gevoelige informatie lekt naar de client, zoals stack traces, interne exception-details of wachtwoordhashes.

### Mitigatiemaatregelen

#### 1. Stack traces verborgen in productie

**Bestand:** `Program.cs` (regels 53–63)

```csharp
if (app.Environment.IsDevelopment())
{
    // Gedetailleerde foutpagina's ALLEEN in Development
    app.UseDeveloperExceptionPage();
}
else
{
    // Generieke foutafhandeling in Production – GEEN stack traces of interne details
    app.UseExceptionHandler("/error");
    app.UseHsts();
}
```

In Development zijn gedetailleerde exception-pagina's beschikbaar voor debugging. In productie worden alle uitzonderingen afgevangen door de generieke `ExceptionHandler`, die alleen een `500 – An unexpected error occurred` teruggeeft. Interne details, bestandspaden of stack traces worden **nooit** naar de client gestuurd.

**Generiek foutendpoint** (onderaan `Program.cs`):

```csharp
app.Map("/error", () => Results.Problem("An unexpected error occurred.", statusCode: 500));
```

---

#### 2. Wachtwoordhashes verborgen via DTO's

**Bestand:** `DTOs/Dtos.cs` (regel 9)

```csharp
// User DTOs — WachtwoordHash is intentionally excluded to prevent Information Disclosure
public record UserDto(int Id, string Naam, string Email, string Rol);
```

Het `User`-model bevat een `WachtwoordHash` veld. De `UserDto` sluit dit veld bewust uit. **Op geen enkel API-endpoint wordt de hash teruggestuurd naar de client.**

Bewijs:
- `Controllers/AuthController.cs` (regels 44–45): response gebruikt `UserDto`, niet het volledige `User`-object.
- `Controllers/AdminController.cs` (regel 25): `users.Select(u => new UserDto(...))` filtert de hash weg.

---

#### 3. Geen gevoelige info in foutberichten

**Bestand:** `Controllers/AuthController.cs` (regels 51–52)

```csharp
if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Wachtwoord, user.WachtwoordHash))
    return Unauthorized(new { message = "Ongeldig e-mailadres of wachtwoord." });
```

Een generiek foutbericht wordt teruggegeven bij mislukte login, zodat een aanvaller **niet** kan achterhalen of een e-mailadres bestaat (user enumeration attack).

---

#### 4. CORS beperkt tot vertrouwde origins

**Bestand:** `Program.cs` (regels 39–46)

```csharp
options.AddPolicy("FrontendPolicy", policy =>
{
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials();
});
```

Alleen de Vite development server heeft toegang tot de API. Wildcard-origins (`*`) zijn **niet** gebruikt.

---

## 🤖 AI Integratie (MCP – Model Context Protocol)

De `SuggestionsService` (`Services/SuggestionsService.cs`) implementeert het MCP-principe:

1. **Context ophalen** – Laadt het gebruikersprofiel en doelen uit de database.
2. **Context-enriched prompt samenstellen** – Voegt profieldata toe aan de gebruikersvraag.
3. **AI-model aanroepen** – Stuurt de verrijkte prompt naar de Gemini API.

Om AI-suggesties in te schakelen: voeg een Gemini API-sleutel toe in `appsettings.json` onder `Gemini:ApiKey`.

---

## 🛠️ Tech Stack

| Laag      | Technologie                                              |
|-----------|----------------------------------------------------------|
| Backend   | ASP.NET Core 10 Web API, EF Core 9, Pomelo MySQL         |
| Auth      | JWT Bearer, BCrypt.Net-Next                              |
| Database  | MySQL 8+                                                 |
| Frontend  | React 18, Vite, TypeScript, Tailwind CSS, react-router-dom, axios |
| AI        | Google Gemini API (MCP-patroon)                          |


## STRIDE-bedreigingen

| ID | STRIDE | Bedreiging | Getroffen onderdeel | Prioriteit | Actie | Maatregel |
|---|---|---|---|---|---|---|
| TM-01 | Spoofing | Een aanvaller logt in als een andere gebruiker via credential stuffing of zwakke wachtwoorden. | Authenticatie-endpoints, accounts | Hoog | Mitigeren | Sterk wachtwoordbeleid, wachtwoorden hashen met Argon2 of bcrypt, generieke foutmeldingen bij inloggen, rate limiting en lockout/backoff na herhaalde mislukte pogingen. |
| TM-02 | Spoofing | Een vervalste of gestolen JWT geeft toegang tot beschermde endpoints. | Frontend, API | Hoog | Mitigeren | Kortlevende JWT’s, sterke signing key, issuer/audience/signature/expiry valideren, client-side rolclaims niet vertrouwen zonder servervalidatie, alleen HTTPS gebruiken. |
| TM-03 | Tampering | Een gebruiker manipuleert requests om geplande maaltijden, favorieten, profiel of doelen van een andere gebruiker te wijzigen (IDOR / mass assignment). | API-controllers, database | Hoog | Mitigeren | Nooit vertrouwen op `userId` uit de client, account afleiden uit de geauthenticeerde token, ownership checks afdwingen op elke read/write, bindbare velden beperken. |
| TM-04 | Tampering | SQL-injectie of onveilige query-opbouw via zoek-/filterinput of admin-CRUD-invoer. | API, database | Hoog | Mitigeren | EF Core-parameterisatie gebruiken, dynamische SQL vermijden, input valideren en normaliseren, server-side modelvalidatie toepassen. |
| TM-05 | Tampering | Prompt injection of kwaadaardige invoer veroorzaakt onveilige of irrelevante Gemini-suggesties. | SuggestionsController, Gemini-flow | Midden | Mitigeren | Prompttemplate begrenzen, alleen toegestane velden meesturen, niet-ondersteunde instructies strippen, outputlengte beperken, response valideren voordat die wordt getoond. |
| TM-06 | Repudiation | Een admin wijzigt maaltijden of ingrediënten en ontkent later dat gedaan te hebben. | Admin-endpoints, database | Midden | Mitigeren | Audit logging toevoegen met actor-id, actie, doelentiteit, timestamp en waar relevant before/after-waarden. |
| TM-07 | Information Disclosure | Gevoelige profiel-/doeldata, wachtwoordhashes, JWT’s of API-sleutels lekken via logs, foutmeldingen of configuratiebestanden. | API, database, deploymentconfiguratie | Hoog | Mitigeren | Secrets opslaan in environment variables of een secret store, logs opschonen, nooit tokens of wachtwoorden loggen, generieke technische foutmeldingen teruggeven aan gebruikers. |
| TM-08 | Information Disclosure | Er wordt te veel persoonlijke data naar de Gemini API gestuurd. | SuggestionsController, Gemini-flow | Hoog | Mitigeren | Dataminimalisatie toepassen: alleen noodzakelijke profiel- en doelwaarden meesturen, namen en e-mails vermijden, externe datadeling documenteren, opt-in of expliciete melding overwegen. |
| TM-09 | Information Disclosure | Een verkeerde CORS- of authenticatieconfiguratie stelt beschermde API-responses cross-origin bloot. | API | Midden | Mitigeren | Restrictieve CORS-allowlist, geen wildcard met credentials, rolchecks server-side afdwingen, ongeautoriseerde toegang expliciet testen. |
| TM-10 | Denial of Service | Login-, browse- of suggestion-endpoints worden gespamd, waardoor de dienst trager wordt of uitvalt. | Frontend, API | Midden | Mitigeren | Rate limiting, throttling per IP, limieten op requestgrootte, paginering en limieten op invoerlengte. |
| TM-11 | Denial of Service | Gemini API, TheMealDB API of FoodData Central USDA API is traag of niet beschikbaar, waardoor suggesties of maaltijd- en voedingsinformatie niet werkt. | Externe API-flows | Midden | Mitigeren | Time-outs, retries met backoff, circuit breaker, nette fallbackmeldingen, eventueel caching van veelgebruikte maaltijd- en voedingsdata. |
| TM-12 | Elevation of Privilege | Een normale gebruiker bereikt adminfunctionaliteit door de frontend-UI te omzeilen of tokens/requests te manipuleren. | API admin-endpoints | Hoog | Mitigeren | `[Authorize(Roles="Admin")]` of equivalent afdwingen op elk admin-endpoint, standaard weigeren, niet vertrouwen op alleen verborgen UI. |
| TM-13 | Elevation of Privilege | Het databaseaccount heeft ruimere rechten dan nodig, waardoor de impact van een compromise groter wordt. | API, database | Midden | Mitigeren | Least-privilege databasegebruiker, migratie- of admincredentials scheiden van runtime-account, netwerkisolatie zodat de database alleen vanaf de API bereikbaar is. |
| TM-14 | Repudiation / Integrity | Er ontbreken integriteitscontroles rondom externe data, waardoor onbetrouwbare maaltijd- of voedingswaarden worden opgeslagen of getoond. | TheMealDB-integratie, database | Midden | Mitigeren | Geïmporteerd schema valideren, alleen verwachte velden mappen, bron en update-tijd vastleggen, fail closed bij foutieve externe responses. |
| TM-15 | Information Disclosure / Abuse | De USDA API-sleutel lekt via frontendcode, logs of client-zichtbare requests, waardoor misbruik of quota-verbruik door derden mogelijk wordt. | API-configuratie, deployment, uitgaande USDA-integratie | Midden | Mitigeren | USDA-key alleen server-side bewaren, opslaan in environment variables of een secret store, nooit blootstellen aan de frontend, uit logs redigeren, beperken op IP of referrer als dat wordt ondersteund. |
| TM-16 | Integrity | Onjuiste of verkeerd geformatteerde voedingsdata uit FoodData Central wordt zonder validatie vertrouwd en als correcte maaltijdinformatie getoond. | USDA-integratie, nutrient mapping, database | Midden | Mitigeren | Schema en eenheden valideren, alleen verwachte nutrientvelden mappen, bron en timestamp vastleggen, ontbrekende waarden veilig afhandelen en fallbackmelding tonen bij incomplete data. |



## Threat model mitigaties

### TM-02
Bestand:
- `MealplannerApp/MealPlannerApi/Program.cs`

Wijziging:
- Commentaar toegevoegd bij de JWT-authenticatieconfiguratie.

Waarom:
- Deze configuratie valideert JWT-tokens op issuer, audience, lifetime en signing key voordat toegang tot protected API-endpoints wordt toegestaan. Dit helpt unauthorized API access te mitigeren.
- Alleen commentaar toegoevoegd omdat JWT auth er al in zat.

### TM-09
Bestanden:
- `MealplannerApp/MealPlannerApi/Program.cs`
- `MealplannerApp/MealPlannerApi/Controllers/SuggestionsController.cs`

Wijziging:
- Gebruik gemaakt van CORS-configuratie in `Program.cs`.
- Commentaar toegevoegd bij de `[Authorize]`-beveiliging van `SuggestionsController.cs`.

Waarom:
- In `Program.cs` wordt een CORS-policy toegepast zodat alleen toegestane frontend-origins toegang krijgen.
- In `SuggestionsController.cs` is de endpoint alleen beschikbaar voor geauthenticeerde gebruikers.
- Samen zorgen deze maatregelen er voor dat het risico dat protected API-responses cross-origin of zonder juiste autorisatie erg laag blijft.

