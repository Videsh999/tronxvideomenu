"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  ArrowLeft,
  Video,
  Utensils,
  CheckCircle2,
  XCircle,
  Check,
  ArrowUp,
  ArrowDown,
  Trash2,
  ImagePlus,
} from "lucide-react";
import type { AddonGroup, Category, Dish, DishMediaItem } from "@/types";
import { api } from "@/lib/api";
import { canUseNextImage } from "@/lib/image-url";
import AdminModal from "@/components/admin/AdminModal";
import MediaPicker from "@/components/admin/MediaPicker";
import SmartImage from "@/components/shared/SmartImage";
import { dishSchema } from "@/lib/validations";

const dishFormSchema = dishSchema.omit({ restaurantId: true });
type DishFormInput = z.input<typeof dishFormSchema>;
type DishFormValues = z.output<typeof dishFormSchema>;

const sectionTitleClass = "text-xs font-bold uppercase tracking-[0.14em] text-neutral-400";
const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700";
const secondaryButtonClass = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50";
const fieldClass = (invalid: boolean) =>
  `h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition focus:outline-none focus:ring-2 focus:ring-neutral-900/10 [&:is(textarea)]:h-auto [&:is(textarea)]:py-2.5 ${invalid ? "border-rose-400" : "border-neutral-200 focus:border-neutral-400"}`;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-rose-600">{message}</p> : null;
}

type DishesManagerProps = {
  initialDishes: Dish[];
  categories: Category[];
  addonGroups: AddonGroup[];
  restaurantId: string;
  videoMenuEnabled?: boolean;
  mediaLibraryEnabled?: boolean;
};

export default function DishesManager({
  initialDishes,
  categories,
  addonGroups,
  restaurantId,
  videoMenuEnabled = true,
  mediaLibraryEnabled = true,
}: DishesManagerProps) {
  const router = useRouter();
  const [dishes, setDishes] = useState(initialDishes);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [mediaPickerType, setMediaPickerType] = useState<
    "IMAGE" | "VIDEO" | null
  >(null);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"main" | "gallery">("main");
  const [galleryUrl, setGalleryUrl] = useState("");
  const [galleryUrlType, setGalleryUrlType] = useState<DishMediaItem["type"]>("IMAGE");

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DishFormInput, unknown, DishFormValues>({
    resolver: zodResolver(dishFormSchema),
    defaultValues: {
      categoryId: categories[0]?.id ?? "",
      name: "",
      description: "",
      price: 0,
      preparationTime: undefined,
      type: "VEG",
      isAvailable: true,
      isCustomizable: false,
      sortOrder: dishes.length + 1,
      addonGroupIds: [],
      imageUrl: "",
      videoUrl: "",
      videoPosterUrl: "",
      gallery: [],
    },
  });

  const selectedAddonGroupIds = watch("addonGroupIds") ?? [];
  const gallery = watch("gallery") ?? [];

  const setGallery = (next: DishMediaItem[]) =>
    setValue("gallery", next, { shouldDirty: true, shouldValidate: true });
  const addGalleryItem = (type: DishMediaItem["type"], url: string) => {
    const trimmed = url.trim();
    if (!trimmed || gallery.some((item) => item.url === trimmed)) return;
    setGallery([...gallery, { id: `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, type, url: trimmed }]);
  };
  const moveGalleryItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[index], next[target]] = [next[target], next[index]];
    setGallery(next);
  };
  const dishType = watch("type");
  const imageUrlValue = watch("imageUrl")?.trim();

  const openCreate = () => {
    setEditing(null);
    setSubmitError(null);
    setFeedback(null);
    reset({
      categoryId: categories[0]?.id ?? "",
      name: "",
      description: "",
      price: 0,
      type: "VEG",
      isAvailable: true,
      isCustomizable: false,
      sortOrder: dishes.length + 1,
      addonGroupIds: [],
      imageUrl: "",
      videoUrl: "",
      videoPosterUrl: "",
      gallery: [],
    });
    setGalleryUrl("");
    setModalOpen(true);
  };

  const openEdit = (dish: Dish) => {
    setEditing(dish);
    setSubmitError(null);
    setFeedback(null);
    reset({
      categoryId: dish.categoryId,
      name: dish.name,
      description: dish.description ?? "",
      price: dish.price,
      preparationTime: dish.preparationTime,
      type: dish.type ?? (dish.isVeg ? "VEG" : "NON_VEG"),
      isAvailable: dish.isAvailable,
      isCustomizable: dish.isCustomizable ?? false,
      sortOrder: dish.sortOrder,
      addonGroupIds:
        dish.addonGroupIds ?? dish.addonGroups?.map((g) => g.id) ?? [],
      imageUrl: dish.imageUrl ?? dish.image ?? "",
      videoUrl: dish.videoUrl ?? dish.video ?? "",
      videoPosterUrl: dish.videoPosterUrl ?? "",
      gallery: dish.gallery ?? [],
    });
    setGalleryUrl("");
    setModalOpen(true);
  };

  const toggleAddonGroup = (groupId: string) => {
    const current = selectedAddonGroupIds;
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setValue("addonGroupIds", next, { shouldDirty: true });
    setValue("isCustomizable", next.length > 0, { shouldDirty: true });
  };

  const onSubmit = async (values: DishFormValues) => {
    setSubmitError(null);
    const payload = {
      ...values,
      image: values.imageUrl || undefined,
      videoUrl: videoMenuEnabled ? values.videoUrl : undefined,
      video: videoMenuEnabled ? values.videoUrl || undefined : undefined,
      gallery: (values.gallery ?? []).filter((item) => videoMenuEnabled || item.type === "IMAGE"),
      addonGroupIds: values.addonGroupIds ?? [],
      isCustomizable:
        values.isCustomizable ?? (values.addonGroupIds?.length ?? 0) > 0,
    };

    try {
      if (editing) {
        const updated = await api.updateDish(editing.id, payload);
        setDishes((prev) =>
          prev
            .map((d) => (d.id === updated.id ? updated : d))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
      } else {
        const created = await api.createDish({
          ...payload,
          restaurantId,
        });
        setDishes((prev) =>
          [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder),
        );
      }
      setModalOpen(false);
      setFeedback({
        type: "success",
        message: editing
          ? "Dish updated successfully."
          : "Dish created successfully.",
      });
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDelete = async (dish: Dish) => {
    if (!window.confirm(`Delete dish "${dish.name}"?`)) return;
    try {
      await api.deleteDish(dish.id);
      setDishes((prev) => prev.filter((d) => d.id !== dish.id));
      setFeedback({ type: "success", message: "Dish deleted successfully." });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Delete failed",
      });
    }
  };

  const toggleAvailability = async (dish: Dish) => {
    try {
      const updated = await api.updateDish(dish.id, {
        isAvailable: !dish.isAvailable,
      });
      setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setFeedback({
        type: "success",
        message: `Dish ${updated.isAvailable ? "marked available" : "marked unavailable"}.`,
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Update failed",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/admin/${encodeURIComponent(restaurantId)}/menu`}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Menu Hub</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Dishes
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Catalogue your food and drink offerings, prices, and video previews.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={categories.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          <span>Add dish</span>
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Create a category first</p>
            <p className="mt-0.5 text-sm text-neutral-500">Every dish lives in a category, like Starters, Mains or Drinks.</p>
          </div>
          <Link href={`/admin/${encodeURIComponent(restaurantId)}/menu/categories`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800">Add categories</Link>
        </div>
      ) : null}

      {feedback ? (
        <p
          role="status"
          className={`text-sm ${
            feedback.type === "success" ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-white text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Dish</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Category</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4 text-center">Type</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {dishes.map((dish) => {
                const categoryName =
                  categoryMap.get(dish.categoryId) || "Uncategorized";
                const hasVideo = videoMenuEnabled && Boolean(dish.videoUrl || dish.video);
                const imageSrc = dish.imageUrl || dish.image;

                return (
                  <tr key={dish.id} className="hover:bg-white transition">
                    <td className="py-4 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                          {imageSrc ? (
                            canUseNextImage(imageSrc) ? (
                              <Image
                                src={imageSrc}
                                alt={dish.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <img
                                src={imageSrc}
                                alt={dish.name}
                                className="h-full w-full object-cover"
                              />
                            )
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-300">
                              <Utensils className="h-5 w-5" />
                            </div>
                          )}
                          {hasVideo ? (
                            <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white">
                              ▶
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-neutral-900">
                              {dish.name}
                            </span>
                            {hasVideo ? (
                              <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-900">
                                <Video className="h-2.5 w-2.5" />
                                Video
                              </span>
                            ) : null}
                          </div>
                          {dish.description ? (
                            <p className="line-clamp-1 text-xs text-neutral-500 max-w-sm">
                              {dish.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-neutral-600 hidden md:table-cell">
                      {categoryName}
                    </td>
                    <td className="py-4 px-4 font-bold text-neutral-900">
                      ₹{dish.price}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                          dish.isVeg ? "border-emerald-500" : "border-rose-500"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            dish.isVeg ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAvailability(dish)}
                      >
                        {dish.isAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            In Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600">
                            <XCircle className="h-3 w-3" />
                            Sold Out
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-4 pr-4 pl-2 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEdit(dish)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dish)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AdminModal
        title={editing ? `Edit ${editing.name}` : "Add a dish"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="min-h-4 text-xs font-medium text-rose-600">{submitError}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="dish-form"
                disabled={isSubmitting}
                className="h-11 rounded-xl bg-neutral-900 px-6 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add dish"}
              </button>
            </div>
          </div>
        }
      >
        <form
          id="dish-form"
          noValidate
          onSubmit={handleSubmit(onSubmit, () => setSubmitError("Please fix the highlighted fields."))}
          className="space-y-6"
        >
          <section className="space-y-4">
            <h3 className={sectionTitleClass}>Basics</h3>
            <label className="block">
              <span className={labelClass}>Dish name</span>
              <input {...register("name")} placeholder="e.g. Butter Chicken" aria-invalid={Boolean(errors.name)} className={fieldClass(Boolean(errors.name))} />
              <FieldError message={errors.name?.message} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Category</span>
                <select {...register("categoryId")} aria-invalid={Boolean(errors.categoryId)} className={fieldClass(Boolean(errors.categoryId))}>
                  <option value="" disabled>Select a category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <FieldError message={errors.categoryId ? "Choose a category" : undefined} />
              </label>
              <label className="block">
                <span className={labelClass}>Price (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="0"
                  {...register("price", { setValueAs: (value) => (value === "" || value == null ? Number.NaN : Number(value)) })}
                  aria-invalid={Boolean(errors.price)}
                  className={fieldClass(Boolean(errors.price))}
                />
                <FieldError message={errors.price ? "Enter a price of 0 or more" : undefined} />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Description <span className="font-normal text-neutral-400">(optional)</span></span>
              <textarea {...register("description")} rows={3} placeholder="Ingredients, taste, portion size…" className={fieldClass(Boolean(errors.description))} />
              <FieldError message={errors.description?.message} />
            </label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Dish type">
              {(["VEG", "NON_VEG"] as const).map((type) => (
                <label key={type} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${dishType === type ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                  <input type="radio" value={type} {...register("type")} className="sr-only" />
                  <span className={`grid h-3.5 w-3.5 place-items-center rounded-[3px] border-2 ${type === "VEG" ? "border-emerald-600" : "border-rose-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${type === "VEG" ? "bg-emerald-600" : "bg-rose-600"}`} /></span>
                  {type === "VEG" ? "Veg" : "Non-veg"}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-neutral-100 pt-5">
            <h3 className={sectionTitleClass}>Photo{videoMenuEnabled ? " & video" : ""}</h3>
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                {imageUrlValue ? <SmartImage src={imageUrlValue} alt="" sizes="64px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-neutral-300"><ImagePlus className="h-5 w-5" /></span>}
              </div>
              <label className="block min-w-0 flex-1">
                <span className={labelClass}>Main photo</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input {...register("imageUrl")} placeholder="Paste an image link" className={`${fieldClass(Boolean(errors.imageUrl))} min-w-0 flex-1`} />
                  {mediaLibraryEnabled ? <button type="button" onClick={() => { setMediaPickerTarget("main"); setMediaPickerType("IMAGE"); }} className={secondaryButtonClass}>Choose from library</button> : null}
                </div>
                <FieldError message={errors.imageUrl?.message} />
              </label>
            </div>
            {videoMenuEnabled ? (
              <>
                <label className="block">
                  <span className={labelClass}>Video <span className="font-normal text-neutral-400">(optional, plays on the menu card)</span></span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input {...register("videoUrl")} placeholder="Paste a video link (.mp4 or .m3u8)" className={`${fieldClass(Boolean(errors.videoUrl))} min-w-0 flex-1`} />
                    {mediaLibraryEnabled ? <button type="button" onClick={() => { setMediaPickerTarget("main"); setMediaPickerType("VIDEO"); }} className={secondaryButtonClass}>Choose from library</button> : null}
                  </div>
                  <FieldError message={errors.videoUrl?.message} />
                </label>
                <label className="block">
                  <span className={labelClass}>Video cover image <span className="font-normal text-neutral-400">(optional)</span></span>
                  <input {...register("videoPosterUrl")} placeholder="Shown while the video loads" className={fieldClass(Boolean(errors.videoPosterUrl))} />
                  <FieldError message={errors.videoPosterUrl?.message} />
                </label>
              </>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-neutral-100 pt-5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h3 className={sectionTitleClass}>Gallery</h3>
                <p className="mt-0.5 text-xs text-neutral-500">Extra photos{videoMenuEnabled ? " and videos" : ""} guests can swipe through.</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">{gallery.length}/12</span>
            </div>
            {gallery.length ? (
              <ul className="space-y-2">
                {gallery.map((item, index) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                      {item.type === "IMAGE" ? (
                        <SmartImage src={item.url} alt="" sizes="48px" className="object-cover" />
                      ) : (
                        <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-bold uppercase text-white">{item.type === "IMAGE" ? "Photo" : "Video"}</span>
                    </div>
                    <p className="min-w-0 flex-1 truncate text-xs text-neutral-500" title={item.url}>{item.url}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => moveGalleryItem(index, -1)} disabled={index === 0} aria-label="Move up" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveGalleryItem(index, 1)} disabled={index === gallery.length - 1} aria-label="Move down" className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setGallery(gallery.filter((entry) => entry.id !== item.id))} aria-label="Remove from gallery" className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {gallery.length < 12 ? (
              <div className="space-y-2">
                {mediaLibraryEnabled ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setMediaPickerTarget("gallery"); setMediaPickerType("IMAGE"); }} className={secondaryButtonClass}><ImagePlus className="h-4 w-4" /> Add photo</button>
                    {videoMenuEnabled ? <button type="button" onClick={() => { setMediaPickerTarget("gallery"); setMediaPickerType("VIDEO"); }} className={secondaryButtonClass}><Video className="h-4 w-4" /> Add video</button> : null}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {videoMenuEnabled ? (
                    <select value={galleryUrlType} onChange={(event) => setGalleryUrlType(event.target.value as DishMediaItem["type"])} aria-label="Gallery media type" className={`${fieldClass(false)} sm:w-28`}>
                      <option value="IMAGE">Photo</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  ) : null}
                  <input
                    value={galleryUrl}
                    onChange={(event) => setGalleryUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addGalleryItem(videoMenuEnabled ? galleryUrlType : "IMAGE", galleryUrl);
                        setGalleryUrl("");
                      }
                    }}
                    placeholder="…or paste a link"
                    className={`${fieldClass(false)} min-w-0 flex-1`}
                  />
                  <button type="button" onClick={() => { addGalleryItem(videoMenuEnabled ? galleryUrlType : "IMAGE", galleryUrl); setGalleryUrl(""); }} disabled={!galleryUrl.trim()} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> Add</button>
                </div>
              </div>
            ) : null}
            <FieldError message={errors.gallery ? errors.gallery.message ?? "Check the gallery items." : undefined} />
          </section>

          {addonGroups.length ? (
            <section className="space-y-3 border-t border-neutral-100 pt-5">
              <div>
                <h3 className={sectionTitleClass}>Add-ons</h3>
                <p className="mt-0.5 text-xs text-neutral-500">Extras guests can pick, like toppings or sizes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {addonGroups.map((group) => {
                  const selected = selectedAddonGroupIds.includes(group.id);
                  return (
                    <button key={group.id} type="button" aria-pressed={selected} onClick={() => toggleAddonGroup(group.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
                      {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {group.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-4 border-t border-neutral-100 pt-5">
            <h3 className={sectionTitleClass}>More options</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Preparation time (minutes) <span className="font-normal text-neutral-400">(optional)</span></span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="e.g. 15"
                  {...register("preparationTime", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })}
                  className={fieldClass(Boolean(errors.preparationTime))}
                />
                <FieldError message={errors.preparationTime ? "Use whole minutes, 0 or more" : undefined} />
              </label>
              <label className="block">
                <span className={labelClass}>Position in category</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  {...register("sortOrder", { setValueAs: (value) => (value === "" || value == null ? undefined : Number(value)) })}
                  className={fieldClass(Boolean(errors.sortOrder))}
                />
                <FieldError message={errors.sortOrder ? "Use a whole number, 0 or more" : undefined} />
              </label>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-neutral-900">Available to order</span>
                <span className="block text-xs text-neutral-500">Turn off when it&apos;s sold out. It stays on the menu, marked unavailable.</span>
              </span>
              <input type="checkbox" {...register("isAvailable")} className="h-5 w-5 shrink-0 accent-neutral-900" />
            </label>
          </section>
        </form>
      </AdminModal>

      {mediaLibraryEnabled && <MediaPicker
        open={mediaPickerType !== null}
        mediaType={mediaPickerType ?? "IMAGE"}
        restaurantId={restaurantId}
        onClose={() => setMediaPickerType(null)}
        onSelect={(media) => {
          if (mediaPickerTarget === "gallery") {
            addGalleryItem(media.type, media.url);
          } else if (mediaPickerType === "IMAGE") {
            setValue("imageUrl", media.url, {
              shouldDirty: true,
              shouldValidate: true,
            });
          } else if (mediaPickerType === "VIDEO") {
            setValue("videoUrl", media.url, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }}
      />}
    </div>
  );
}
