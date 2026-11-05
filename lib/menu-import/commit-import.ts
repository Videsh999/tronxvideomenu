import { connectToDatabase } from "@/lib/db/mongodb";
import { AddonGroupModel, AddonModel, CategoryModel, DishModel } from "@/lib/db/models";
import type { Category } from "@/types";
import type { ImportCommitResult, ImportItemDraft, ImportPreview, MenuImportJob } from "./types";
import { normalizeHeader, slugifyName } from "./normalize";

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureCategory(
  restaurantId: string,
  name: string,
  cache: Map<string, Category>,
  createdIds: string[],
  sortOrder: number,
): Promise<Category> {
  const key = normalizeHeader(name);
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await CategoryModel.findOne({
    restaurantId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).lean();
  if (existing) {
    const category = {
      id: existing.id,
      restaurantId: existing.restaurantId,
      name: existing.name,
      slug: existing.slug,
      sortOrder: existing.sortOrder,
      isActive: existing.isActive,
    } as Category;
    cache.set(key, category);
    return category;
  }

  const id = newId("cat");
  const timestamp = nowIso();
  const doc = {
    id,
    restaurantId,
    name,
    slug: slugifyName(name),
    sortOrder,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await CategoryModel.create(doc);
  createdIds.push(id);
  const category = doc as Category;
  cache.set(key, category);
  return category;
}

async function createAddonGroupWithOptions(
  restaurantId: string,
  groupName: string,
  options: Array<{ name: string; price: number }>,
  required: boolean,
  createdGroupIds: string[],
  createdAddonIds: string[],
): Promise<string> {
  const timestamp = nowIso();
  const groupId = newId("ag");
  await AddonGroupModel.create({
    id: groupId,
    restaurantId,
    name: groupName,
    isRequired: required,
    minSelect: required ? 1 : 0,
    maxSelect: required ? 1 : Math.max(1, options.length),
    sortOrder: 0,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  createdGroupIds.push(groupId);

  for (const [index, option] of options.entries()) {
    const addonId = newId("ad");
    await AddonModel.create({
      id: addonId,
      addonGroupId: groupId,
      name: option.name,
      price: Math.max(0, option.price),
      isActive: true,
      isAvailable: true,
      sortOrder: index,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    createdAddonIds.push(addonId);
  }
  return groupId;
}

export async function commitImportPreview(
  job: MenuImportJob,
  preview: ImportPreview,
): Promise<{ result: ImportCommitResult; rollback: NonNullable<MenuImportJob["rollback"]> }> {
  await connectToDatabase();

  const included = preview.items.filter((item) => item.included && item.errors.length === 0);
  const invalidRows = preview.items.filter((item) => item.errors.length > 0).length;
  const rollback: NonNullable<MenuImportJob["rollback"]> = {
    createdCategoryIds: [],
    createdDishIds: [],
    updatedDishes: [],
    createdAddonGroupIds: [],
    createdAddonIds: [],
  };

  const result: ImportCommitResult = {
    createdCategories: 0,
    createdDishes: 0,
    updatedDishes: 0,
    createdAddonGroups: 0,
    createdAddons: 0,
    skipped: preview.items.filter((item) => !item.included).length,
    totalRows: preview.items.length,
    validRows: preview.items.filter((item) => item.errors.length === 0).length,
    invalidRows,
    failedRows: 0,
    warningCount: preview.items.reduce((sum, item) => sum + item.warnings.length, 0),
    errors: [],
  };

  const categoryCache = new Map<string, Category>();
  const existingCategories = await CategoryModel.find({ restaurantId: job.restaurantId }).lean();
  for (const category of existingCategories) {
    categoryCache.set(normalizeHeader(category.name), {
      id: category.id,
      restaurantId: category.restaurantId,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    } as Category);
  }

  let categorySort = existingCategories.length;

  try {
    for (const item of included) {
      const categoryBefore = categoryCache.size;
      const category = await ensureCategory(
        job.restaurantId,
        item.categoryName,
        categoryCache,
        rollback.createdCategoryIds,
        categorySort,
      );
      if (categoryCache.size > categoryBefore && rollback.createdCategoryIds.includes(category.id)) {
        result.createdCategories += 1;
        categorySort += 1;
      }

      const extraGroupIds: string[] = [];
      if (item.variants.length) {
        const groupId = await createAddonGroupWithOptions(
          job.restaurantId,
          "Size",
          item.variants.map((variant) => ({ name: variant.name, price: variant.price })),
          true,
          rollback.createdAddonGroupIds,
          rollback.createdAddonIds,
        );
        extraGroupIds.push(groupId);
        result.createdAddonGroups += 1;
        result.createdAddons += item.variants.length;
      }

      if (item.addons.length) {
        const groups = new Map<string, ImportItemDraft["addons"]>();
        for (const addon of item.addons) {
          const list = groups.get(addon.groupName) ?? [];
          list.push(addon);
          groups.set(addon.groupName, list);
        }
        for (const [groupName, addons] of groups) {
          const groupId = await createAddonGroupWithOptions(
            job.restaurantId,
            groupName,
            addons.map((addon) => ({ name: addon.name, price: addon.price })),
            false,
            rollback.createdAddonGroupIds,
            rollback.createdAddonIds,
          );
          extraGroupIds.push(groupId);
          result.createdAddonGroups += 1;
          result.createdAddons += addons.length;
        }
      }

      const price = item.price ?? (item.variants.length ? Math.min(...item.variants.map((variant) => variant.price)) : null);
      if (price === null) {
        result.errors.push(`Skipped “${item.name}”: missing price.`);
        result.failedRows = (result.failedRows ?? 0) + 1;
        continue;
      }

      const dietary = item.dietary === "VEG" || item.dietary === "NON_VEG" ? item.dietary : "VEG";
      const timestamp = nowIso();

      if (item.action === "UPDATE" && item.matchDishId) {
        const existing = await DishModel.findOne({ id: item.matchDishId, restaurantId: job.restaurantId }).lean();
        if (!existing) {
          result.errors.push(`Could not update “${item.name}”: matched dish missing.`);
          result.failedRows = (result.failedRows ?? 0) + 1;
          continue;
        }
        rollback.updatedDishes.push({
          id: existing.id,
          before: {
            name: existing.name,
            description: existing.description,
            price: existing.price,
            categoryId: existing.categoryId,
            type: existing.type,
            isVeg: existing.isVeg,
            isAvailable: existing.isAvailable,
            preparationTime: existing.preparationTime,
            addonGroupIds: existing.addonGroupIds,
            sku: (existing as { sku?: string }).sku,
          },
        });
        const nextAddonGroupIds = Array.from(new Set([...(existing.addonGroupIds ?? []), ...extraGroupIds]));
        await DishModel.updateOne(
          { id: existing.id },
          {
            $set: {
              name: item.name,
              description: item.description ?? existing.description,
              price,
              categoryId: category.id,
              type: dietary,
              isVeg: dietary === "VEG",
              isAvailable: item.isAvailable,
              preparationTime: item.prepTimeMinutes ?? existing.preparationTime,
              addonGroupIds: nextAddonGroupIds,
              isCustomizable: nextAddonGroupIds.length > 0,
              sku: item.sku ?? (existing as { sku?: string }).sku,
              updatedAt: timestamp,
            },
          },
        );
        result.updatedDishes += 1;
      } else {
        const id = newId("dish");
        await DishModel.create({
          id,
          restaurantId: job.restaurantId,
          categoryId: category.id,
          name: item.name,
          slug: slugifyName(item.sku || item.name),
          description: item.description,
          price,
          preparationTime: item.prepTimeMinutes ?? undefined,
          type: dietary,
          isVeg: dietary === "VEG",
          isAvailable: item.isAvailable,
          isCustomizable: extraGroupIds.length > 0,
          sortOrder: result.createdDishes,
          addonGroupIds: extraGroupIds,
          sku: item.sku,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        rollback.createdDishIds.push(id);
        result.createdDishes += 1;
      }
    }
  } catch (error) {
    await rollbackImport(rollback);
    throw error instanceof Error ? error : new Error("Import failed and was rolled back.");
  }

  return { result, rollback };
}

export async function rollbackImport(rollback: NonNullable<MenuImportJob["rollback"]>): Promise<void> {
  await connectToDatabase();
  if (rollback.createdDishIds.length) await DishModel.deleteMany({ id: { $in: rollback.createdDishIds } });
  if (rollback.createdAddonIds.length) await AddonModel.deleteMany({ id: { $in: rollback.createdAddonIds } });
  if (rollback.createdAddonGroupIds.length) await AddonGroupModel.deleteMany({ id: { $in: rollback.createdAddonGroupIds } });
  if (rollback.createdCategoryIds.length) {
    for (const categoryId of rollback.createdCategoryIds) {
      const remaining = await DishModel.countDocuments({ categoryId });
      if (remaining === 0) await CategoryModel.deleteOne({ id: categoryId });
    }
  }
  for (const entry of rollback.updatedDishes) {
    await DishModel.updateOne({ id: entry.id }, { $set: { ...entry.before, updatedAt: nowIso() } });
  }
}
