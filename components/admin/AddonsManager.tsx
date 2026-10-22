"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ArrowLeft, Sliders, CheckCircle2 } from "lucide-react";
import type { Addon, AddonGroup } from "@/types";
import { api } from "@/lib/api";
import AdminModal from "@/components/admin/AdminModal";
import { addonGroupSchema, addonSchema } from "@/lib/validations";

const groupFormSchema = addonGroupSchema.omit({ restaurantId: true });
type GroupFormInput = z.input<typeof groupFormSchema>;
type GroupFormValues = z.output<typeof groupFormSchema>;

const addonFormSchema = addonSchema;
type AddonFormInput = z.input<typeof addonFormSchema>;
type AddonFormValues = z.output<typeof addonFormSchema>;

type AddonsManagerProps = {
  initialGroups: AddonGroup[];
  restaurantId: string;
};

const sortGroups = (groups: AddonGroup[]) =>
  [...groups].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

export default function AddonsManager({
  initialGroups,
  restaurantId,
}: AddonsManagerProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(() => sortGroups(initialGroups));
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AddonGroup | null>(null);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [addonGroupId, setAddonGroupId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const groupForm = useForm<GroupFormInput, unknown, GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: 0,
      isActive: true,
    },
  });

  const addonForm = useForm<AddonFormInput, unknown, AddonFormValues>({
    resolver: zodResolver(addonFormSchema),
    defaultValues: {
      addonGroupId: "",
      name: "",
      price: 0,
      isActive: true,
      isAvailable: true,
      sortOrder: 0,
    },
  });

  const openCreateGroup = () => {
    setEditingGroup(null);
    setError(null);
    setFeedback(null);
    groupForm.reset({
      name: "",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      sortOrder: groups.length,
      isActive: true,
    });
    setGroupModalOpen(true);
  };

  const openEditGroup = (group: AddonGroup) => {
    setEditingGroup(group);
    setError(null);
    setFeedback(null);
    groupForm.reset({
      name: group.name,
      isRequired: group.isRequired,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      sortOrder: group.sortOrder ?? 0,
      isActive: group.isActive ?? true,
    });
    setGroupModalOpen(true);
  };

  const submitGroup = async (values: GroupFormValues) => {
    setError(null);
    try {
      if (editingGroup) {
        const updated = await api.updateAddonGroup(editingGroup.id, values);
        setGroups((prev) =>
          sortGroups(
            prev.map((g) =>
              g.id === updated.id ? { ...updated, addons: g.addons } : g,
            ),
          ),
        );
      } else {
        const created = await api.createAddonGroup({
          ...values,
          restaurantId,
        });
        setGroups((prev) => sortGroups([...prev, { ...created, addons: [] }]));
      }
      setGroupModalOpen(false);
      setFeedback({
        type: "success",
        message: editingGroup
          ? "Add-on group updated successfully."
          : "Add-on group created successfully.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const deleteGroup = async (group: AddonGroup) => {
    if (!window.confirm(`Delete group "${group.name}" and its add-ons?`))
      return;
    try {
      await api.deleteAddonGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setFeedback({
        type: "success",
        message: "Add-on group deleted successfully.",
      });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Delete failed",
      });
    }
  };

  const openCreateAddon = (groupId: string) => {
    setEditingAddon(null);
    setAddonGroupId(groupId);
    setError(null);
    setFeedback(null);
    addonForm.reset({
      addonGroupId: groupId,
      name: "",
      price: 0,
      isActive: true,
      isAvailable: true,
      sortOrder: 0,
    });
    setAddonModalOpen(true);
  };

  const openEditAddon = (addon: Addon, groupId: string) => {
    setEditingAddon(addon);
    setAddonGroupId(groupId);
    setError(null);
    setFeedback(null);
    addonForm.reset({
      addonGroupId: groupId,
      name: addon.name,
      price: addon.price,
      isActive: addon.isActive ?? true,
      isAvailable: addon.isAvailable ?? true,
      sortOrder: addon.sortOrder ?? 0,
    });
    setAddonModalOpen(true);
  };

  const submitAddon = async (values: AddonFormValues) => {
    setError(null);
    try {
      if (editingAddon) {
        const updated = await api.updateAddon(editingAddon.id, values);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === addonGroupId
              ? {
                  ...g,
                  addons: g.addons.map((a) =>
                    a.id === updated.id ? updated : a,
                  ),
                }
              : g,
          ),
        );
      } else {
        const created = await api.createAddon(values);
        setGroups((prev) =>
          prev.map((g) =>
            g.id === values.addonGroupId
              ? { ...g, addons: [...g.addons, created] }
              : g,
          ),
        );
      }
      setAddonModalOpen(false);
      setFeedback({
        type: "success",
        message: editingAddon
          ? "Add-on updated successfully."
          : "Add-on created successfully.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const deleteAddonItem = async (addon: Addon, groupId: string) => {
    if (!window.confirm(`Delete add-on "${addon.name}"?`)) return;
    try {
      await api.deleteAddon(addon.id);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, addons: g.addons.filter((a) => a.id !== addon.id) }
            : g,
        ),
      );
      setFeedback({ type: "success", message: "Add-on deleted successfully." });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Delete failed",
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
            Add-ons & Options
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Define customisation groups, dips, toppings, and selection
            constraints.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateGroup}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          <span>New Add-on Group</span>
        </button>
      </div>

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

      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">
                    {group.name}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {group.maxSelect === 1
                      ? "Single choice (Radio)"
                      : `Multi-choice (Up to ${group.maxSelect})`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {group.isRequired ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    Mandatory
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                    Optional
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEditGroup(group)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition"
                >
                  Edit Group
                </button>
                <button
                  type="button"
                  onClick={() => deleteGroup(group)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => openCreateAddon(group.id)}
                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Add item
                </button>
              </div>
            </div>

            <div className="mt-3 divide-y divide-neutral-100">
              {group.addons.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="text-neutral-700 font-medium">
                      {addon.name}
                    </span>
                    {!addon.isAvailable ? (
                      <span className="text-[10px] text-rose-600">
                        Unavailable
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-neutral-900">
                      {addon.price > 0 ? `+₹${addon.price}` : "Free"}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditAddon(addon, group.id)}
                      className="text-xs text-neutral-400 hover:text-neutral-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAddonItem(addon, group.id)}
                      className="text-xs text-rose-600 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AdminModal
        title={editingGroup ? "Edit Add-on Group" : "New Add-on Group"}
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGroupModalOpen(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-xs text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addon-group-form"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        <form
          id="addon-group-form"
          onSubmit={groupForm.handleSubmit(submitGroup)}
          className="space-y-3"
        >
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          <input
            {...groupForm.register("name")}
            placeholder="Group name"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              {...groupForm.register("minSelect", { valueAsNumber: true })}
              placeholder="Min select"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
            <input
              type="number"
              {...groupForm.register("maxSelect", { valueAsNumber: true })}
              placeholder="Max select"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
            />
          </div>
          <input
            type="number"
            {...groupForm.register("sortOrder", { valueAsNumber: true })}
            placeholder="Sort order"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" {...groupForm.register("isRequired")} />
            Required selection
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" {...groupForm.register("isActive")} />
            Active
          </label>
        </form>
      </AdminModal>

      <AdminModal
        title={editingAddon ? "Edit Add-on" : "New Add-on"}
        open={addonModalOpen}
        onClose={() => setAddonModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddonModalOpen(false)}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-xs text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="addon-item-form"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
            >
              Save
            </button>
          </div>
        }
      >
        <form
          id="addon-item-form"
          onSubmit={addonForm.handleSubmit(submitAddon)}
          className="space-y-3"
        >
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          {editingAddon ? (
            <>
              <input type="hidden" {...addonForm.register("addonGroupId")} />
              <p className="text-xs text-neutral-500">
                Group:{" "}
                {groups.find((group) => group.id === addonGroupId)?.name ??
                  "Unknown"}
              </p>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Add-on group
              </label>
              <select
                {...addonForm.register("addonGroupId")}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <input
            {...addonForm.register("name")}
            placeholder="Add-on name"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
          />
          <input
            type="number"
            step="1"
            {...addonForm.register("price", { valueAsNumber: true })}
            placeholder="Price"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
          />
          <input
            type="number"
            {...addonForm.register("sortOrder", { valueAsNumber: true })}
            placeholder="Sort order"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" {...addonForm.register("isAvailable")} />
            Available
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" {...addonForm.register("isActive")} />
            Active
          </label>
        </form>
      </AdminModal>
    </div>
  );
}
