"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Coupon, CustomerFeedback, CustomerProfile } from "@/types";

type Props = { restaurantName: string };

export default function CrmManager({ restaurantName }: Props) {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [feedback, setFeedback] = useState<CustomerFeedback[]>([]);
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponValue, setCouponValue] = useState(10);

  async function refresh(q?: string) {
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
    if (cJson.success) setCustomers(cJson.data);
    if (couponJson.success) setCoupons(couponJson.data);
    if (fbJson.success) setFeedback(fbJson.data);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/crm/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, marketingOptIn: true }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not save customer");
      return;
    }
    setPhone("");
    setName("");
    setMessage(`Saved ${json.data.phone}`);
    await refresh(query);
  }

  async function saveCoupon(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/crm/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        discountType: "PERCENT",
        discountValue: couponValue,
      }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not create coupon");
      return;
    }
    setCouponCode("");
    setMessage(`Coupon ${json.data.code} created`);
    await refresh(query);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">CRM & loyalty</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
      </header>
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">{message}</p>
      ) : null}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phone, name, email"
          className="min-h-11 flex-1 rounded-xl border border-neutral-200 px-3"
        />
        <button
          type="button"
          onClick={() => void refresh(query)}
          className="min-h-11 rounded-xl bg-neutral-900 px-4 text-white"
        >
          Search
        </button>
      </div>

      <form onSubmit={saveCustomer} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone"
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white">
          Save customer
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Points</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Opt-in</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium">{customer.name || customer.phone}</div>
                  <div className="text-neutral-500">{customer.phone}</div>
                </td>
                <td className="px-4 py-3">{customer.loyaltyPoints}</td>
                <td className="px-4 py-3">{customer.totalOrders}</td>
                <td className="px-4 py-3">{customer.marketingOptIn ? "Yes" : "No"}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-neutral-500">
                  No customers yet. Capture phone numbers at the POS or host stand.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <form onSubmit={saveCoupon} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-4">
        <input
          required
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Coupon code"
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <input
          type="number"
          min={1}
          value={couponValue}
          onChange={(e) => setCouponValue(Number(e.target.value) || 1)}
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white md:col-span-2">
          Create % coupon
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Coupons</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="flex justify-between border-b border-neutral-100 pb-2">
                <span>
                  {coupon.code} · {coupon.discountValue}
                  {coupon.discountType === "PERCENT" ? "%" : " off"}
                </span>
                <span className="text-neutral-500">{coupon.redemptionCount} uses</span>
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
                {"★".repeat(item.rating)} {item.comment || ""}
              </li>
            ))}
            {feedback.length === 0 ? <li className="text-neutral-500">No feedback yet.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
