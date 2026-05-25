const INGREDIENT_IMAGE_ALIASES: Record<string, string> = {
  kaas: 'Cheese',
  kip: 'Chicken',
  paprika: 'Red Pepper',
  siroop: 'Syrup',
  stroop: 'Syrup',
  tomaat: 'Tomato',
  tomaten: 'Tomato',
  ui: 'Onion',
  uien: 'Onion',
  wafel: 'Waffles',
  wafels: 'Waffles',
};

export function getIngredientImageUrl(name: string) {
  const alias = INGREDIENT_IMAGE_ALIASES[name.trim().toLowerCase()];
  const normalized = (alias ?? name)
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '_');

  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(normalized)}-medium.png`;
}
