"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, MapPin, Clock, Wifi, Eye, EyeOff } from "lucide-react";
import type { Restaurant } from "@/types";
import { api } from "@/lib/api";
import { restaurantAdminProfileSchema } from "@/lib/validations";

const profileFormSchema = restaurantAdminProfileSchema;
type ProfileFormInput = z.input<typeof profileFormSchema>;
type ProfileFormValues = z.output<typeof profileFormSchema>;

type WifiAdminState = {
  ssid: string;
  security: "WPA2" | "WPA3" | "OPEN";
  passwordConfigured: boolean;
};

type RestaurantProfileFormProps = {
  restaurant: Restaurant;
  restaurantId: string;
  wifiEnabled?: boolean;
  initialWifi?: WifiAdminState | null;
};

export default function RestaurantProfileForm({
  restaurant,
  restaurantId,
  wifiEnabled = false,
  initialWifi = null,
}: RestaurantProfileFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wifi, setWifi] = useState<WifiAdminState>(() => initialWifi ?? {
    ssid: "",
    security: "WPA2",
    passwordConfigured: false,
  });
  const [wifiPassword, setWifiPassword] = useState("");
  const [clearWifiPassword, setClearWifiPassword] = useState(false);
  const [wifiPasswordFocused, setWifiPasswordFocused] = useState(false);
  const [wifiPasswordRevealed, setWifiPasswordRevealed] = useState(false);
  const [wifiSaving, setWifiSaving] = useState(false);
  const [wifiMessage, setWifiMessage] = useState("");
  const [wifiError, setWifiError] = useState("");

  useEffect(() => {
    if (!initialWifi) return;
    setWifi(initialWifi);
  }, [initialWifi]);

  const saveWifi = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWifiSaving(true);
    setWifiError("");
    setWifiMessage("");

    const trimmedPassword = wifiPassword.trim();
    if (wifi.security !== "OPEN" && trimmedPassword && trimmedPassword.length < 8) {
      setWifiError("Wi-Fi password must be at least 8 characters.");
      setWifiSaving(false);
      return;
    }
    if (wifi.security !== "OPEN" && !wifi.passwordConfigured && !trimmedPassword && !clearWifiPassword) {
      setWifiError("Enter a Wi-Fi password for this secured network.");
      setWifiSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/restaurant/wifi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: wifi.ssid.trim(),
          security: wifi.security,
          ...(wifi.security !== "OPEN" && trimmedPassword ? { password: trimmedPassword } : {}),
          clearPassword: wifi.security !== "OPEN" && clearWifiPassword,
        }),
      });
      const result = await response.json() as { success: boolean; data?: WifiAdminState; error?: string };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to save Wi-Fi settings.");
      }
      setWifi(result.data);
      setWifiPassword("");
      setClearWifiPassword(false);
      setWifiPasswordFocused(false);
      setWifiPasswordRevealed(false);
      if (result.data.security === "OPEN") {
        setWifiMessage("Wi-Fi saved as an open network (no password).");
      } else if (clearWifiPassword) {
        setWifiMessage("Wi-Fi saved. The password was cleared.");
      } else if (trimmedPassword) {
        setWifiMessage("Wi-Fi saved. New password stored securely.");
      } else {
        setWifiMessage("Wi-Fi saved. Existing password kept.");
      }
    } catch (cause) {
      setWifiError(cause instanceof Error ? cause.message : "Unable to save Wi-Fi settings.");
    } finally {
      setWifiSaving(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: restaurant.name,
      logoUrl: restaurant.logoUrl ?? restaurant.logo ?? "",
      coverUrl: restaurant.coverUrl ?? restaurant.coverImage ?? "",
      description: restaurant.description ?? "",
      tagline: restaurant.tagline ?? "",
      phone: restaurant.phone ?? "",
      email: restaurant.email ?? "",
      address: restaurant.address ?? "",
      openingHours: restaurant.openingHours ?? "",
      currency: restaurant.currency ?? "INR",
      isOpen: restaurant.isOpen,
      socialLinks: {
        instagram: restaurant.socialLinks?.instagram ?? "",
        facebook: restaurant.socialLinks?.facebook ?? "",
        twitter: restaurant.socialLinks?.twitter ?? "",
        website: restaurant.socialLinks?.website ?? "",
      },
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    setError(null);
    setSaved(false);
    try {
      await api.updateRestaurant(restaurantId, {
        ...values,
        logo: values.logoUrl,
        coverImage: values.coverUrl,
        email: values.email || undefined,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Restaurant Profile
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your restaurant profile and customer-facing contact details.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-6"
      >
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-emerald-700">
            Profile saved successfully.
          </p>
        ) : null}

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Brand Identity
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Restaurant Name
              </label>
              <input
                {...register("name")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300"
              />
              {errors.name ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.name.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Logo URL
              </label>
              <input
                {...register("logoUrl")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Cover image URL
              </label>
              <input
                {...register("coverUrl")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Tagline
            </label>
            <input
              {...register("tagline")}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900"
            />
            {errors.tagline ? (
              <p className="mt-1 text-xs text-rose-600">
                {errors.tagline.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              {...register("description")}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-900 focus:outline-none"
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-rose-600">
                {errors.description.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 border-t border-neutral-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Contact & Timings
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Phone Number
              </label>
              <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
                <Phone className="h-4 w-4 text-neutral-400 mr-2.5" />
                <input
                  {...register("phone")}
                  className="w-full bg-transparent text-sm text-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900"
              />
              {errors.email ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Opening Hours
              </label>
              <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
                <Clock className="h-4 w-4 text-neutral-400 mr-2.5" />
                <input
                  {...register("openingHours")}
                  className="w-full bg-transparent text-sm text-neutral-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Currency
              </label>
              <input
                {...register("currency")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900"
              />
              {errors.currency ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.currency.message}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Physical Address
            </label>
            <div className="flex items-start rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
              <MapPin className="h-4 w-4 text-neutral-400 mr-2.5 mt-0.5" />
              <textarea
                rows={2}
                {...register("address")}
                className="w-full bg-transparent text-sm text-neutral-900 leading-relaxed focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-neutral-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Social Links
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              {...register("socialLinks.instagram")}
              placeholder="Instagram URL"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
            <input
              {...register("socialLinks.facebook")}
              placeholder="Facebook URL"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
            <input
              {...register("socialLinks.twitter")}
              placeholder="Twitter / X URL"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
            <input
              {...register("socialLinks.website")}
              placeholder="Website URL"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="block font-medium text-neutral-900 text-sm">
              Live Operating Status
            </span>
            <span className="block text-xs text-neutral-500">
              Control whether the menu indicates the restaurant is actively
              taking diners.
            </span>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" {...register("isOpen")} />
            Open for service
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
      {wifiEnabled ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
              <Wifi className="h-4 w-4" /> Restaurant Wi-Fi
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Guests can open these details from the menu. Leave the password blank to keep the one already saved.
            </p>
          </div>
          {wifiError ? <p role="alert" className="text-sm text-rose-600">{wifiError}</p> : null}
          {wifiMessage ? <p role="status" className="text-sm text-emerald-700">{wifiMessage}</p> : null}
          <form onSubmit={(event) => void saveWifi(event)} className="grid gap-4 sm:grid-cols-2" autoComplete="off">
            <label className="text-xs text-neutral-500 sm:col-span-2">
              Network name (SSID)
              <input
                required
                name="wifi-ssid"
                maxLength={32}
                value={wifi.ssid}
                onChange={(event) => setWifi((current) => ({ ...current, ssid: event.target.value }))}
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Security
              <select
                name="wifi-security"
                value={wifi.security}
                onChange={(event) => {
                  setWifi((current) => ({ ...current, security: event.target.value as WifiAdminState["security"] }));
                  setClearWifiPassword(false);
                }}
                className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-sm text-neutral-900"
              >
                <option value="WPA2">WPA2</option>
                <option value="WPA3">WPA3</option>
                <option value="OPEN">Open network</option>
              </select>
            </label>
            {wifi.security !== "OPEN" ? (
              <div className="space-y-2">
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                    <span>Wi-Fi password</span>
                    {wifi.passwordConfigured && !clearWifiPassword ? (
                      <span className="font-semibold text-emerald-700">Saved · leave blank to keep</span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type={wifiPasswordRevealed ? "text" : "password"}
                      name="wifi-network-key"
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      readOnly={!wifiPasswordFocused}
                      onFocus={() => setWifiPasswordFocused(true)}
                      maxLength={63}
                      value={wifiPassword}
                      onChange={(event) => {
                        setWifiPassword(event.target.value);
                        if (event.target.value) setClearWifiPassword(false);
                      }}
                      placeholder={wifi.passwordConfigured ? "(leave blank to keep)" : "Enter password (8+ characters)"}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 font-mono text-sm text-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={() => setWifiPasswordRevealed((value) => !value)}
                      aria-label={wifiPasswordRevealed ? "Hide password" : "Show password"}
                      aria-pressed={wifiPasswordRevealed}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neutral-300 bg-white text-neutral-800 transition hover:bg-neutral-100"
                    >
                      {wifiPasswordRevealed ? <EyeOff className="h-4 w-4" strokeWidth={2.25} /> : <Eye className="h-4 w-4" strokeWidth={2.25} />}
                    </button>
                  </div>
                </div>
                {wifi.passwordConfigured ? (
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={clearWifiPassword}
                      onChange={(event) => {
                        setClearWifiPassword(event.target.checked);
                        if (event.target.checked) {
                          setWifiPassword("");
                          setWifiPasswordRevealed(false);
                        }
                      }}
                    />
                    Clear the saved password
                  </label>
                ) : null}
              </div>
            ) : (
              <p className="self-center text-xs text-neutral-500">
                Open networks do not use a password. Saving will remove any stored password.
              </p>
            )}
            <div className="flex justify-end sm:col-span-2">
              <button
                type="submit"
                disabled={wifiSaving}
                className="rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {wifiSaving ? "Saving…" : "Save Wi-Fi settings"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
