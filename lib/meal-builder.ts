import type { Category, Dish } from "@/types";

export type MealMood = "eat" | "drink" | "both";
export type PartySize = "one" | "two" | "small" | "large";

export const PARTY_DISH_COUNT: Record<PartySize, number> = { one: 2, two: 3, small: 5, large: 7 };

const DRINK_CATEGORY = /drink|beverage|coffee|tea|juice|mocktail|cocktail|shake|smoothie|soda|lassi|wine|beer|bar|brew|latte|matcha|refresher|cooler/i;

export function isDrinkCategory(category: Pick<Category, "name"> | undefined) {
  return Boolean(category && DRINK_CATEGORY.test(category.name));
}

type Selection = { groupId: string; addonIds: string[] };

/** Default add-on choices that satisfy every rule, or null when the guest must choose. */
export function defaultSelections(dish: Dish): Selection[] | null {
  const selections: Selection[] = [];
  for (const group of dish.addonGroups ?? []) {
    if (group.isActive === false) continue;
    const needed = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
    const available = group.addons.filter((addon) => addon.isActive !== false && addon.isAvailable !== false);
    if (needed > Math.min(available.length, group.maxSelect)) return null;
    selections.push({ groupId: group.id, addonIds: available.slice(0, needed).map((addon) => addon.id) });
  }
  return selections;
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** Random picks spread across as many categories as possible. */
function pickVaried(pool: Dish[], count: number, random: () => number) {
  const byCategory = new Map<string, Dish[]>();
  for (const dish of shuffle(pool, random)) {
    const list = byCategory.get(dish.categoryId) ?? [];
    list.push(dish);
    byCategory.set(dish.categoryId, list);
  }
  const queues = shuffle([...byCategory.values()], random);
  const picks: Dish[] = [];
  while (picks.length < count && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) picks.push(next);
      if (picks.length === count) break;
    }
  }
  return picks;
}

type MealPool = { food: Dish[]; drinks: Dish[] };

export function mealPool(dishes: Dish[], categories: Category[], vegOnly: boolean): MealPool {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const eligible = dishes.filter((dish) => dish.isAvailable && categoryById.has(dish.categoryId) && (!vegOnly || dish.isVeg));
  return {
    food: eligible.filter((dish) => !isDrinkCategory(categoryById.get(dish.categoryId))),
    drinks: eligible.filter((dish) => isDrinkCategory(categoryById.get(dish.categoryId))),
  };
}

/**
 * Fills a meal of `size` slots. Slots that hold a locked dish keep it; every other
 * slot gets a new, non-repeating pick matching the guest's mood.
 */
export function buildMeal(options: {
  pool: MealPool;
  mood: MealMood;
  size: number;
  locked?: (Dish | null)[];
  random?: () => number;
}): Dish[] {
  const { pool, mood, size, random = Math.random } = options;
  const locked = Array.from({ length: size }, (_, index) => options.locked?.[index] ?? null);
  const keptIds = new Set(locked.filter((dish): dish is Dish => Boolean(dish)).map((dish) => dish.id));
  const open = locked.filter((dish) => !dish).length;
  const fresh = (list: Dish[]) => list.filter((dish) => !keptIds.has(dish.id));

  let picks: Dish[];
  if (mood === "eat") picks = pickVaried(fresh(pool.food), open, random);
  else if (mood === "drink") picks = pickVaried(fresh(pool.drinks), open, random);
  else {
    const keptDrinks = locked.filter((dish) => dish && pool.drinks.some((drink) => drink.id === dish.id)).length;
    const wantedDrinks = Math.max(0, Math.max(1, Math.round(size / 3)) - keptDrinks);
    const drinks = pickVaried(fresh(pool.drinks), Math.min(open, wantedDrinks), random);
    const food = pickVaried(fresh(pool.food), open - drinks.length, random);
    picks = [...food, ...drinks];
    if (picks.length < open) {
      const used = new Set(picks.map((dish) => dish.id));
      picks.push(...pickVaried(fresh([...pool.food, ...pool.drinks]).filter((dish) => !used.has(dish.id)), open - picks.length, random));
    }
  }

  const queue = [...picks];
  return locked.map((dish) => dish ?? queue.shift() ?? null).filter((dish): dish is Dish => Boolean(dish));
}
