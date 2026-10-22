import mongoose, { Schema } from "mongoose";
import type {
  Addon,
  AddonGroup,
  Category,
  Dish,
  Media,
  Restaurant,
  RestaurantTable,
  RestaurantOrder,
  RestaurantTheme,
  RestaurantWifiConfiguration,
  Captain,
  RestaurantAdminAccount,
  Reservation,
} from "@/types";

const baseOptions = {
  strict: true,
  versionKey: false as const,
};

const restaurantWifiSchema = new Schema<RestaurantWifiConfiguration>(
  {
    ssid: { type: String, required: true, trim: true, maxlength: 32 },
    security: { type: String, required: true, enum: ["WPA2", "WPA3", "OPEN"] },
    passwordCiphertext: String,
    passwordIv: String,
    passwordAuthTag: String,
  },
  { _id: false, strict: true },
);

const restaurantSchema = new Schema<Restaurant>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    logo: String,
    coverImage: String,
    description: String,
    tagline: String,
    phone: String,
    email: String,
    address: String,
    openingHours: String,
    currency: String,
    socialLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      website: String,
    },
    isOpen: { type: Boolean, required: true, default: true },
    isActive: { type: Boolean, default: true },
    logoUrl: String,
    coverUrl: String,
    createdAt: String,
    updatedAt: String,
    subscriptionPlan: {
      type: String,
      enum: ["STARTER", "PRO", "ENTERPRISE"],
      default: "PRO",
    },
    subscriptionStatus: {
      type: String,
      enum: ["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"],
      default: "ACTIVE",
    },
    subscriptionEnabled: { type: Boolean, default: true },
    featureOverrides: {
      type: Map,
      of: Boolean,
      default: {},
    },
    theme: {
      type: {
        primaryColor: String,
        secondaryColor: String,
        accentColor: String,
        backgroundColor: String,
        textColor: String,
        buttonStyle: {
          type: String,
          enum: ["filled", "outlined", "gradient"],
        },
        borderRadius: {
          type: String,
          enum: ["sharp", "rounded", "pill"],
        },
      },
      default: {},
    },
    wifi: { type: restaurantWifiSchema, default: undefined },
  },
  { ...baseOptions, collection: "restaurants" },
);

const categorySchema = new Schema<Category>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    slug: String,
    description: String,
    sortOrder: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "categories" },
);

const dishSchema = new Schema<Dish>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    slug: String,
    description: String,
    price: { type: Number, required: true },
    preparationTime: { type: Number, min: 0 },
    type: { type: String, enum: ["VEG", "NON_VEG"] },
    isVeg: { type: Boolean, required: true },
    isAvailable: { type: Boolean, required: true, default: true },
    isCustomizable: { type: Boolean, default: false },
    image: String,
    video: String,
    imageUrl: String,
    videoUrl: String,
    videoPosterUrl: String,
    gallery: {
      type: [new Schema(
        {
          id: { type: String, required: true },
          type: { type: String, enum: ["IMAGE", "VIDEO"], required: true },
          url: { type: String, required: true },
          posterUrl: String,
        },
        { _id: false, strict: true },
      )],
      default: [],
    },
    sortOrder: { type: Number, required: true, default: 0 },
    addonGroupIds: { type: [String], default: [] },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "dishes" },
);

const addonGroupSchema = new Schema<AddonGroup>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    isRequired: { type: Boolean, required: true, default: false },
    minSelect: { type: Number, required: true, default: 0 },
    maxSelect: { type: Number, required: true, default: 1 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "addonGroups" },
);

const addonSchema = new Schema<Addon>(
  {
    id: { type: String, required: true, unique: true, index: true },
    addonGroupId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "addons" },
);

const mediaSchema = new Schema<Media>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    type: { type: String, enum: ["IMAGE", "VIDEO"], required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      required: true,
    },
    format: String,
    width: Number,
    height: Number,
    duration: Number,
    isExternal: { type: Boolean, default: false },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "media" },
);

const tableSchema = new Schema<RestaurantTable>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true },
    tableNumber: { type: Number, required: true, min: 1 },
    label: String,
    capacity: { type: Number, min: 1 },
    reservationRevision: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "OCCUPIED", "CLOSED"],
      default: "OPEN",
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "tables" },
);
tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

const orderAddonSnapshotSchema = new Schema(
  {
    addonId: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: true },
);

const orderItemSnapshotSchema = new Schema(
  {
    dishId: { type: String, required: true },
    dishNameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    addons: { type: [orderAddonSnapshotSchema], default: [] },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: true },
);

const paymentAuditEventSchema = new Schema(
  {
    eventId: { type: String, required: true },
    action: {
      type: String,
      enum: ["RECORD", "CORRECTION", "REVERSAL"],
      required: true,
    },
    previousStatus: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PAID"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PAID"],
      required: true,
    },
    previousMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
    },
    newMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
    },
    amount: { type: Number, required: true, min: 0 },
    actor: {
      role: {
        type: String,
        enum: ["RESTAURANT_ADMIN", "CAPTAIN"],
        required: true,
      },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    reason: String,
    timestamp: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const paymentSummarySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PAID"],
      required: true,
      default: "UNPAID",
    },
    method: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
    },
    amount: { type: Number, min: 0 },
    recordedAt: String,
    recordedBy: {
      role: {
        type: String,
        enum: ["RESTAURANT_ADMIN", "CAPTAIN"],
      },
      id: String,
      email: String,
      name: String,
    },
    auditTrail: { type: [paymentAuditEventSchema], default: [] },
  },
  { _id: false, strict: true },
);

const orderSchema = new Schema<RestaurantOrder>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true },
    tableId: { type: String, required: true },
    tableNumber: { type: Number, required: true },
    orderNumber: { type: Number, required: true },
    customerTokenHash: { type: String, required: true, select: false },
    idempotencyKey: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "SERVED",
        "CANCELLED",
      ],
      required: true,
      default: "PENDING",
    },
    items: { type: [orderItemSnapshotSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    payment: {
      type: paymentSummarySchema,
      required: true,
      default: () => ({ status: "UNPAID", auditTrail: [] }),
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "orders" },
);
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, createdAt: -1 });

const orderCounterSchema = new Schema(
  {
    restaurantId: { type: String, required: true },
    value: { type: Number, default: 1000 },
  },
  { ...baseOptions, collection: "orderCounters" },
);
const captainSchema = new Schema<Captain>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    passwordCiphertext: { type: String, select: false },
    passwordIv: { type: String, select: false },
    passwordAuthTag: { type: String, select: false },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "captains" },
);
captainSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
const restaurantAdminAccountSchema = new Schema<RestaurantAdminAccount>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    passwordCiphertext: { type: String, select: false },
    passwordIv: { type: String, select: false },
    passwordAuthTag: { type: String, select: false },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "restaurantAdminAccounts" },
);
restaurantAdminAccountSchema.index({ restaurantId: 1 }, { unique: true });
const reservationSchema = new Schema<Reservation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableId: { type: String, required: true },
    tableNumberSnapshot: { type: Number, required: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String, lowercase: true },
    reservationDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, enum: ["Asia/Kolkata"], default: "Asia/Kolkata" },
    guestCount: { type: Number, required: true, min: 1 },
    specialRequest: { type: String, maxlength: 1000 },
    status: { type: String, required: true, enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"], default: "PENDING" },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "reservations" },
);
reservationSchema.index({ restaurantId: 1, tableId: 1, status: 1, startAt: 1, endAt: 1 });
reservationSchema.index({ restaurantId: 1, reservationDate: 1, startTime: 1 });
orderCounterSchema.index({ restaurantId: 1 }, { unique: true });

export const RestaurantModel =
  mongoose.models.Restaurant ??
  mongoose.model<Restaurant>("Restaurant", restaurantSchema);
export const CategoryModel =
  mongoose.models.Category ??
  mongoose.model<Category>("Category", categorySchema);
export const DishModel =
  mongoose.models.Dish ?? mongoose.model<Dish>("Dish", dishSchema);
export const AddonGroupModel =
  mongoose.models.AddonGroup ??
  mongoose.model<AddonGroup>("AddonGroup", addonGroupSchema);
export const AddonModel =
  mongoose.models.Addon ?? mongoose.model<Addon>("Addon", addonSchema);
export const MediaModel =
  mongoose.models.Media ?? mongoose.model<Media>("Media", mediaSchema);
export const TableModel =
  mongoose.models.Table ??
  mongoose.model<RestaurantTable>("Table", tableSchema);
export const OrderModel =
  mongoose.models.Order ??
  mongoose.model<RestaurantOrder>("Order", orderSchema);
export const OrderCounterModel =
  mongoose.models.OrderCounter ??
  mongoose.model("OrderCounter", orderCounterSchema);
export const CaptainModel =
  mongoose.models.Captain ??
  mongoose.model<Captain>("Captain", captainSchema);
export const RestaurantAdminAccountModel =
  mongoose.models.RestaurantAdminAccount ??
  mongoose.model<RestaurantAdminAccount>("RestaurantAdminAccount", restaurantAdminAccountSchema);
export const ReservationModel =
  mongoose.models.Reservation ??
  mongoose.model<Reservation>("Reservation", reservationSchema);
