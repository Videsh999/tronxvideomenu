import { NextResponse } from "next/server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { translateTexts } from "@/lib/services/translation.service";
import { getLanguage, isLanguageCode } from "@/lib/i18n/languages";
import { EN_MESSAGES, MESSAGE_OVERRIDES, placeholdersOf, type MessageKey, type Messages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cacheHeaders = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" };
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = new URL(request.url).searchParams.get("lang");
  if (!isLanguageCode(lang)) {
    return NextResponse.json({ success: false, error: "Unsupported language." }, { status: 400, headers: noStore });
  }
  if (lang === "en") {
    return NextResponse.json({ success: true, data: { lang, ui: {}, content: {}, complete: true } }, { headers: cacheHeaders });
  }

  try {
    const menu = await restaurantService.getFullMenu(slug);
    if (!menu) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });

    const { restaurant, categories, dishes } = menu;
    const contentSources = [
      restaurant.tagline,
      restaurant.description,
      ...categories.flatMap((category) => [category.name, category.description]),
      ...dishes.flatMap((dish) => [
        dish.name,
        dish.description,
        ...(dish.addonGroups ?? []).flatMap((group) => [group.name, ...group.addons.map((addon) => addon.name)]),
      ]),
    ].filter((text): text is string => Boolean(text?.trim()));

    const overrides = MESSAGE_OVERRIDES[lang];
    const machineKeys = (Object.keys(EN_MESSAGES) as MessageKey[]).filter((key) => !overrides[key]);
    const uiSources = machineKeys.map((key) => EN_MESSAGES[key]);

    const translated = await translateTexts([...uiSources, ...contentSources], getLanguage(lang).providerCode);

    const ui: Partial<Messages> = { ...overrides };
    for (const key of machineKeys) {
      const source = EN_MESSAGES[key];
      const text = translated[source];
      if (text && placeholdersOf(text).join() === placeholdersOf(source).join()) ui[key] = text;
    }

    const content: Record<string, string> = {};
    for (const source of contentSources) {
      const text = translated[source.trim()];
      if (text) content[source] = text;
    }

    const complete = contentSources.every((source) => content[source]) && machineKeys.every((key) => ui[key]);
    return NextResponse.json({ success: true, data: { lang, ui, content, complete } }, { headers: complete ? cacheHeaders : noStore });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to translate the menu right now." }, { status: 500, headers: noStore });
  }
}
