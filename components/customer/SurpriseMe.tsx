"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Dices, Lock, LockOpen, ShoppingBag, Utensils, X } from "lucide-react";
import type { Category, Dish } from "@/types";
import SmartImage from "@/components/shared/SmartImage";
import { buildMeal, defaultSelections, mealPool, PARTY_DISH_COUNT, type MealMood, type PartySize } from "@/lib/meal-builder";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Step = "mood" | "party" | "diet" | "meal";

type SurpriseMeProps = {
  dishes: Dish[];
  categories: Category[];
  canOrder: boolean;
  onClose: () => void;
  onOpenDish: (dish: Dish) => void;
  onAddToCart: (entry: { dishId: string; quantity: number; selections: { groupId: string; addonIds: string[] }[] }) => void;
  onViewCart: () => void;
};

const moods: { value: MealMood; label: MessageKey }[] = [
  { value: "eat", label: "moodEat" },
  { value: "drink", label: "moodDrink" },
  { value: "both", label: "moodBoth" },
];
const parties: { value: PartySize; label: MessageKey }[] = [
  { value: "one", label: "partyOne" },
  { value: "two", label: "partyTwo" },
  { value: "small", label: "partySmall" },
  { value: "large", label: "partyLarge" },
];

const optionClass = "flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--customer-border)] bg-white px-4 py-3.5 text-left text-sm font-semibold text-neutral-900 transition hover:border-neutral-900 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40";

export default function SurpriseMe({ dishes, categories, canOrder, onClose, onOpenDish, onAddToCart, onViewCart }: SurpriseMeProps) {
  const { t, tn, tc } = useI18n();
  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<MealMood>("eat");
  const [party, setParty] = useState<PartySize>("two");
  const [vegOnly, setVegOnly] = useState(false);
  const [meal, setMeal] = useState<Dish[]>([]);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [preview, setPreview] = useState<Dish[]>([]);
  const [added, setAdded] = useState<{ count: number; needsChoices: Dish[] } | null>(null);
  const spinTimer = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const allPool = useMemo(() => mealPool(dishes, categories, false), [categories, dishes]);
  const pool = useMemo(() => mealPool(dishes, categories, vegOnly), [categories, dishes, vegOnly]);
  const moodCount = (value: MealMood, source = allPool) => value === "eat" ? source.food.length : value === "drink" ? source.drinks.length : source.food.length + source.drinks.length;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = originalOverflow;
      if (spinTimer.current) window.clearInterval(spinTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[aria-labelledby=dish-modal-title]")) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const spin = (choice: { mood?: MealMood; party?: PartySize; vegOnly?: boolean; keep?: Set<string>; current?: Dish[] } = {}) => {
    const spinMood = choice.mood ?? mood;
    const size = PARTY_DISH_COUNT[choice.party ?? party];
    const spinPool = choice.vegOnly === undefined ? pool : mealPool(dishes, categories, choice.vegOnly);
    const keep = choice.keep ?? locked;
    const current = choice.current ?? meal;
    const lockedSlots = Array.from({ length: size }, (_, index) => (current[index] && keep.has(current[index].id) ? current[index] : null));
    const final = buildMeal({ pool: spinPool, mood: spinMood, size, locked: lockedSlots });
    setAdded(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const candidates = spinMood === "drink" ? spinPool.drinks : spinMood === "eat" ? spinPool.food : [...spinPool.food, ...spinPool.drinks];
    if (reduceMotion || candidates.length < 2) {
      setMeal(final);
      return;
    }
    setSpinning(true);
    let ticks = 0;
    if (spinTimer.current) window.clearInterval(spinTimer.current);
    spinTimer.current = window.setInterval(() => {
      ticks += 1;
      setPreview(final.map((dish, index) => lockedSlots[index] ? dish : candidates[Math.floor(Math.random() * candidates.length)]));
      if (ticks >= 9) {
        if (spinTimer.current) window.clearInterval(spinTimer.current);
        spinTimer.current = null;
        setMeal(final);
        setSpinning(false);
      }
    }, 90);
  };

  const toggleLock = (dish: Dish) => setLocked((current) => {
    const next = new Set(current);
    if (next.has(dish.id)) next.delete(dish.id);
    else next.add(dish.id);
    return next;
  });

  const addMeal = () => {
    const needsChoices: Dish[] = [];
    let count = 0;
    for (const dish of meal) {
      const selections = defaultSelections(dish);
      if (!selections) { needsChoices.push(dish); continue; }
      onAddToCart({ dishId: dish.id, quantity: 1, selections });
      count += 1;
    }
    setAdded({ count, needsChoices });
  };

  const startOver = () => {
    setStep("mood");
    setMeal([]);
    setLocked(new Set());
    setAdded(null);
  };

  const shown = spinning ? preview : meal;
  const total = meal.reduce((sum, dish) => sum + dish.price, 0);
  const stepIndex = { mood: 0, party: 1, diet: 2, meal: 3 }[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="surprise-title"
      className="fixed inset-0 z-[45] flex animate-fade-in items-end justify-center bg-black/55 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="safe-bottom relative flex max-h-[94dvh] w-full max-w-xl animate-sheet-up flex-col overflow-hidden rounded-t-[2rem] bg-white text-neutral-900 shadow-2xl sm:animate-scale-in sm:rounded-[2rem]">
        <div className="flex justify-center pt-3 sm:hidden"><span className="h-1.5 w-12 rounded-full bg-neutral-200" /></div>
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 sm:px-7 sm:pt-6">
          {step !== "mood" && step !== "meal" ? (
            <button type="button" onClick={() => setStep(step === "diet" ? "party" : "mood")} className="inline-flex h-10 items-center gap-1 rounded-full pr-3 text-sm font-semibold text-neutral-500 hover:text-neutral-900"><ChevronLeft className="h-4 w-4" />{t("back")}</button>
          ) : <span className="h-10" />}
          {step !== "meal" ? (
            <ol className="flex items-center gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((index) => <li key={index} className={`h-1.5 rounded-full transition-all ${index === stepIndex ? "w-6 bg-neutral-900" : index < stepIndex ? "w-1.5 bg-neutral-900" : "w-1.5 bg-neutral-200"}`} />)}
            </ol>
          ) : null}
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("closeDetails")} className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-5 pb-6 sm:px-7 sm:pb-7">
          {step === "mood" && (
            <div className="animate-fade-up">
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{t("surpriseHint")}</p>
              <h2 id="surprise-title" className="font-condensed mt-2 text-center text-4xl uppercase">{t("surpriseMood")}</h2>
              <div className="mt-6 space-y-2.5">
                {moods.map(({ value, label }) => (
                  <button key={value} type="button" disabled={!moodCount(value)} onClick={() => { setMood(value); setStep("party"); }} className={optionClass}>
                    <span>{t(label)}</span>
                    <span className="flex items-center gap-2 text-xs font-medium text-neutral-400">{tn("itemCount", moodCount(value))}<ChevronRight className="h-4 w-4" /></span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setMood("both"); setParty("two"); setVegOnly(false); setLocked(new Set()); setStep("meal"); spin({ mood: "both", party: "two", vegOnly: false, keep: new Set(), current: [] }); }} className="mx-auto mt-5 block text-sm font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900">{t("surpriseMe")}</button>
            </div>
          )}

          {step === "party" && (
            <div className="animate-fade-up">
              <h2 id="surprise-title" className="font-condensed mt-2 text-center text-4xl uppercase">{t("surpriseParty")}</h2>
              <div className="mt-6 space-y-2.5">
                {parties.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => { setParty(value); setStep("diet"); }} className={optionClass}>
                    <span>{t(label)}</span>
                    <span className="flex items-center gap-2 text-xs font-medium text-neutral-400">{tn("itemCount", PARTY_DISH_COUNT[value])}<ChevronRight className="h-4 w-4" /></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "diet" && (
            <div className="animate-fade-up">
              <h2 id="surprise-title" className="font-condensed mt-2 text-center text-4xl uppercase">{t("surpriseDiet")}</h2>
              <div className="mt-6 space-y-2.5">
                {[{ veg: true, label: "dietVeg" as const }, { veg: false, label: "dietAny" as const }].map(({ veg, label }) => {
                  const count = moodCount(mood, mealPool(dishes, categories, veg));
                  return (
                    <button key={label} type="button" disabled={!count} onClick={() => { setVegOnly(veg); setLocked(new Set()); setStep("meal"); setMeal([]); spin({ vegOnly: veg, keep: new Set(), current: [] }); }} className={optionClass}>
                      <span className="flex items-center gap-2">{veg ? <span className="grid h-4 w-4 place-items-center rounded-[4px] border-[1.5px] border-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-600" /></span> : null}{t(label)}</span>
                      <span className="flex items-center gap-2 text-xs font-medium text-neutral-400">{tn("itemCount", count)}<ChevronRight className="h-4 w-4" /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "meal" && (
            <div className="animate-fade-up">
              <h2 id="surprise-title" className="font-condensed text-center text-4xl uppercase">{meal.length || spinning ? t("yourMeal") : t("surpriseHint")}</h2>

              {!meal.length && !spinning ? (
                <div className="mt-6 flex justify-center gap-2.5">
                  {Array.from({ length: Math.min(PARTY_DISH_COUNT[party], 3) }, (_, index) => (
                    <div key={index} className="grid aspect-[3/4] w-24 place-items-center rounded-2xl bg-neutral-100 text-neutral-300 sm:w-28"><Utensils className="h-6 w-6" /></div>
                  ))}
                </div>
              ) : (
                <ul className={`mt-6 grid gap-3 ${shown.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                  {shown.map((dish, index) => {
                    const isLocked = locked.has(meal[index]?.id ?? "");
                    return (
                      <li key={`${index}-${spinning ? "spin" : dish.id}`} className="relative">
                        <button
                          type="button"
                          disabled={spinning}
                          onClick={() => onOpenDish(meal[index] ?? dish)}
                          className={`group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-100 text-left ${isLocked ? "ring-2 ring-neutral-900 ring-offset-2" : ""} ${spinning && !isLocked ? "scale-[0.97] blur-[1px]" : "animate-scale-in"} transition`}
                        >
                          {dish.imageUrl ? <SmartImage src={dish.imageUrl} alt="" sizes="160px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-neutral-300"><Utensils className="h-6 w-6" /></span>}
                          <span className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
                          <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                            <span className="font-condensed block text-lg uppercase leading-none">{tc(dish.name)}</span>
                            <span className="mt-1 block text-xs font-semibold tabular-nums text-white/85">₹{dish.price}</span>
                          </span>
                        </button>
                        {!spinning && meal[index] ? (
                          <button
                            type="button"
                            onClick={() => toggleLock(meal[index])}
                            aria-pressed={isLocked}
                            aria-label={isLocked ? t("releaseDish", { name: tc(dish.name) }) : t("keepDish", { name: tc(dish.name) })}
                            className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full shadow transition ${isLocked ? "bg-neutral-900 text-white" : "bg-white/90 text-neutral-700 hover:bg-white"}`}
                          >
                            {isLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              {meal.length > 0 && !spinning ? (
                <>
                  <p className="mt-4 text-center text-xs text-neutral-500">{t("lockHint")}</p>
                  <div className="mt-5 flex items-end justify-between rounded-2xl bg-neutral-50 px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">{t("yourMeal")} · {tn("itemCount", meal.length)}</span>
                    <span className="text-2xl font-bold tabular-nums">₹{total}</span>
                  </div>
                </>
              ) : null}

              {added ? (
                <div role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {added.count > 0 ? <p className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" />{t("mealAdded")} · {tn("itemCount", added.count)}</p> : null}
                  {added.needsChoices.map((dish) => (
                    <button key={dish.id} type="button" onClick={() => onOpenDish(dish)} className="mt-1 block text-left text-xs text-emerald-900 underline underline-offset-2">{t("needsChoices", { name: tc(dish.name) })}</button>
                  ))}
                </div>
              ) : null}

              {meal.length === 0 && !spinning && moodCount(mood, pool) === 0 ? <p className="mt-4 text-center text-sm text-neutral-500">{t("noMatches")}</p> : null}

              <div className="mt-5 space-y-2.5">
                <button type="button" onClick={() => spin()} disabled={spinning || moodCount(mood, pool) === 0} className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
                  <Dices className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />{meal.length ? t("spinAgain") : t("spin")}
                </button>
                {meal.length > 0 && !spinning && canOrder ? (
                  added?.count ? (
                    <button type="button" onClick={onViewCart} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-900 py-3.5 text-sm font-bold text-neutral-900 transition hover:bg-neutral-50"><ShoppingBag className="h-4 w-4" />{t("viewCart")}</button>
                  ) : (
                    <button type="button" onClick={addMeal} className="inline-flex w-full items-center justify-between rounded-full bg-[var(--restaurant-primary)] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[var(--restaurant-primary-dark)]"><span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{t("addMealToCart")}</span><span className="tabular-nums">₹{total}</span></button>
                  )
                ) : null}
                {meal.length > 0 && !spinning ? <button type="button" onClick={startOver} className="mx-auto block pt-1 text-sm font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900">{t("startOver")}</button> : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
