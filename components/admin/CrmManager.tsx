"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Coupon, CustomerFeedback, CustomerProfile } from "@/types";

type Props = { restaurantName: string };

function formatSpend(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function hasLogin(customer: CustomerProfile) {
  return Boolean(customer.hasPassword);
}

export default function CrmManager({ restaurantName }: Props) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [feedback, setFeedback] = useState<CustomerFeedback[]>([]);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [couponValue, setCouponValue] = useState(10);

  async function refresh(q?: string) {
    setLoading(true);
    setError(null);
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const [cRes, couponRes, fbRes] = await Promise.all([
        fetch(`/api/crm/customers${qs}`),
        fetch("/api/crm/coupons"),
        fetch("/api/crm/feedback"),
      ]);
      const [cJson, couponJson, fbJson] = await Promise.all([
        cRes.json(),
        couponRes.json(),
        fbRes.json(),
      ]);
      if (!cRes.ok || !cJson.success) {
        setError(cJson.error || "Could not load customers.");
        setCustomers([]);
      } else {
        setCustomers(cJson.data);
      }
      if (couponJson.success) setCoupons(couponJson.data);
      if (fbJson.success) setFeedback(fbJson.data);
    } catch {
      setError("Could not load CRM data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const response = await fetch("/api/crm/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        marketingOptIn,
        emailOptIn: Boolean(email.trim()),
      }),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Could not save customer");
      return;
    }
    setPhone("");
    setName("");
    setEmail("");
    setNotes("");
    setMarketingOptIn(false);
    setMessage(`Saved ${json.data.name || json.data.phone}`);
    await refresh(query);
  }

  async function saveCoupon(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const clamped = Math.min(Math.max(couponValue, 1), 100);
    const response = await fetch("/api/crm/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        discountType: "PERCENT",
        discountValue: clamped,
      }),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Could not create coupon");
      return;
    }
    setCouponCode("");
    setCouponValue(10);
    setMessage(`Coupon ${json.data.code} created`);
    await refresh(query);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">CRM & loyalty</p>
        <h1 className="font-serif text-2xl text-neutral-900 sm:text-3xl">{restaurantName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Guests from signup, POS, and QR orders — phone, email, points, and spend in one place.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void refresh(query);
          }}
          placeholder="Search phone, name, email"
          className="min-h-11 flex-1 rounded-xl border border-neutral-200 px-3 text-base"
        />
        <button
          type="button"
          onClick={() => void refresh(query)}
          className="min-h-11 rounded-xl bg-neutral-900 px-4 text-white sm:w-auto"
        >
          Search
        </button>
      </div>

      <form
        onSubmit={saveCustomer}
        className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone *"
          inputMode="tel"
          autoComplete="tel"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          autoComplete="name"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base sm:col-span-2"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Marketing opt-in
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white lg:col-span-3">
          Save customer
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Segment</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Opt-in</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                    Loading customers…
                  </td>
                </tr>
              ) : null}
              {!loading &&
                customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-900">
                        {customer.name || customer.phone}
                      </div>
                      <div className="text-neutral-500">{customer.phone}</div>
                      {customer.email ? (
                        <div className="truncate text-xs text-neutral-400">{customer.email}</div>
                      ) : null}
                      {hasLogin(customer) ? (
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Signed up
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                          Walk-in
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{customer.segment || "NEW"}</td>
                    <td className="px-4 py-3 tabular-nums">{customer.loyaltyPoints}</td>
                    <td className="px-4 py-3 tabular-nums">{customer.totalOrders}</td>
                    <td className="px-4 py-3 tabular-nums">{formatSpend(customer.totalSpend)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-500">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="px-4 py-3">{customer.marketingOptIn ? "Yes" : "No"}</td>
                  </tr>
                ))}
              {!loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-neutral-500">
                    No customers yet. They appear when guests sign up for loyalty or you save a phone
                    here / at the POS.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <form
        onSubmit={saveCoupon}
        className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4"
      >
        <input
          required
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Coupon code"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base md:col-span-2"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={couponValue}
          onChange={(e) => setCouponValue(Number(e.target.value) || 1)}
          aria-label="Percent off"
          className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base"
        />
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white">
          Create % coupon
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Coupons</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="flex justify-between gap-3 border-b border-neutral-100 pb-2">
                <span className="min-w-0 truncate">
                  {coupon.code} · {coupon.discountValue}
                  {coupon.discountType === "PERCENT" ? "%" : " off"}
                </span>
                <span className="shrink-0 text-neutral-500">{coupon.redemptionCount} uses</span>
              </li>
            ))}
            {coupons.length === 0 ? <li className="text-neutral-500">No coupons yet.</li> : null}
          </ul>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Feedback</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {feedback.map((item) => (
              <li key={item.id} className="border-b border-neutral-100 pb-2">
                <span className="text-amber-600">{"★".repeat(item.rating)}</span>
                {item.comment ? ` ${item.comment}` : ""}
              </li>
            ))}
            {feedback.length === 0 ? <li className="text-neutral-500">No feedback yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
