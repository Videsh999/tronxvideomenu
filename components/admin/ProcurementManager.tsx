"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Ingredient, InventoryUnit, PurchaseOrder, Supplier } from "@/types";

type Props = { restaurantName: string };

export default function ProcurementManager({ restaurantName }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [reorder, setReorder] = useState<
    { ingredientId: string; name: string; suggestedOrderQuantity: number }[]
  >([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lineIngredientId, setLineIngredientId] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [lineUnit, setLineUnit] = useState<InventoryUnit>("kg");
  const [lineCost, setLineCost] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [sRes, poRes, ingRes] = await Promise.all([
      fetch("/api/procurement/suppliers"),
      fetch("/api/procurement/purchase-orders"),
      fetch("/api/inventory/ingredients"),
    ]);
    const [sJson, poJson, ingJson] = await Promise.all([
      sRes.json(),
      poRes.json(),
      ingRes.json(),
    ]);
    if (sJson.success) {
      setSuppliers(sJson.data);
      if (!supplierId && sJson.data[0]) setSupplierId(sJson.data[0].id);
    }
    if (poJson.success) {
      setOrders(poJson.data.orders);
      setReorder(poJson.data.reorder);
    }
    if (ingJson.success) {
      setIngredients(ingJson.data);
      if (!lineIngredientId && ingJson.data[0]) {
        setLineIngredientId(ingJson.data[0].id);
        setLineUnit(ingJson.data[0].baseUnit);
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addSupplier(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/procurement/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: supplierName }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not create supplier");
      return;
    }
    setSupplierName("");
    setMessage(`Supplier ${json.data.name} added`);
    await refresh();
  }

  async function createPo(event: FormEvent) {
    event.preventDefault();
    if (!supplierId || !lineIngredientId) {
      setMessage("Select supplier and ingredient");
      return;
    }
    const response = await fetch("/api/procurement/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        lines: [
          {
            ingredientId: lineIngredientId,
            quantity: lineQty,
            unit: lineUnit,
            unitCost: lineCost,
          },
        ],
      }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not create PO");
      return;
    }
    setMessage(`PO #${json.data.orderNumber} created`);
    await refresh();
  }

  async function receivePo(order: PurchaseOrder) {
    const outstanding = order.lines.filter((line) => line.receivedQuantity < line.quantity);
    if (outstanding.length === 0) {
      setMessage("Nothing left to receive");
      return;
    }
    const confirmed = window.confirm(
      `Receive remaining quantities for PO #${order.orderNumber}?`,
    );
    if (!confirmed) return;
    const response = await fetch(`/api/procurement/purchase-orders/${order.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: outstanding.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: Math.max(0, line.quantity - line.receivedQuantity),
          unit: line.unit,
          unitCost: line.unitCost,
        })),
      }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Receive failed");
      return;
    }
    setMessage(`Received PO #${order.orderNumber}`);
    await refresh();
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Procurement</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
      </header>
      {message ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">{message}</p>
      ) : null}

      <form onSubmit={addSupplier} className="flex flex-wrap gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <input
          required
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Supplier name"
          className="min-h-11 min-w-[16rem] flex-1 rounded-xl border border-neutral-200 px-3"
        />
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 px-5 text-white">
          Add supplier
        </button>
      </form>

      <form onSubmit={createPo} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-5">
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        >
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <select
          value={lineIngredientId}
          onChange={(e) => setLineIngredientId(e.target.value)}
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        >
          {ingredients.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.id}>
              {ingredient.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0.001}
          step="any"
          value={lineQty}
          onChange={(e) => setLineQty(Number(e.target.value) || 0)}
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <input
          type="number"
          min={0}
          step="any"
          value={lineCost}
          onChange={(e) => setLineCost(Number(e.target.value) || 0)}
          placeholder="Unit cost"
          className="min-h-11 rounded-xl border border-neutral-200 px-3"
        />
        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 text-white">
          Create PO
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Reorder suggestions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {reorder.map((row) => (
              <li key={row.ingredientId} className="flex justify-between border-b border-neutral-100 pb-2">
                <span>{row.name}</span>
                <span>Suggest {row.suggestedOrderQuantity}</span>
              </li>
            ))}
            {reorder.length === 0 ? (
              <li className="text-neutral-500">Stock levels look healthy.</li>
            ) : null}
          </ul>
        </section>
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Purchase orders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                <span>
                  PO #{order.orderNumber} · {order.status}
                </span>
                {(order.status === "SENT" || order.status === "PARTIAL") && (
                  <button
                    type="button"
                    onClick={() => void receivePo(order)}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white"
                  >
                    Receive
                  </button>
                )}
              </li>
            ))}
            {orders.length === 0 ? (
              <li className="text-neutral-500">No purchase orders yet.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
