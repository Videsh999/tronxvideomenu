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
  TableSession,
  MasterBill,
  DynamicPaymentRequest,
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
    coverVideo: String,
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
    billing: {
      taxRatePercent: { type: Number, min: 0, max: 100 },
      taxLabel: { type: String, maxlength: 40 },
      currency: String,
      priceMode: { type: String, enum: ["EXCLUSIVE", "INCLUSIVE"] },
      gstEnabled: Boolean,
      gstRatePercent: { type: Number, min: 0, max: 100 },
      supplyType: { type: String, enum: ["INTRA_STATE", "INTER_STATE"] },
      packagingEnabled: Boolean,
      packagingMethod: {
        type: String,
        enum: ["PER_ORDER", "PER_ITEM", "PER_QUANTITY", "PERCENT_OF_SUBTOTAL"],
      },
      packagingAmount: { type: Number, min: 0 },
      packagingPercent: { type: Number, min: 0, max: 100 },
      serviceChargeEnabled: Boolean,
      serviceChargeType: { type: String, enum: ["FIXED", "PERCENT"] },
      serviceChargeAmount: { type: Number, min: 0 },
      serviceChargePercent: { type: Number, min: 0, max: 100 },
      effectiveFrom: String,
      updatedAt: String,
      updatedByEmail: String,
      upiEnabled: { type: Boolean, default: false },
      upiId: { type: String, maxlength: 120 },
      upiPayeeName: { type: String, maxlength: 120 },
      upiStaticQrUrl: { type: String, maxlength: 2000 },
    },
    organizationId: { type: String, index: true },
    inventorySettings: {
      consumptionPoint: {
        type: String,
        enum: ["ACCEPTED", "PREPARING", "READY", "SERVED"],
      },
      allowRestoreBefore: {
        type: String,
        enum: ["ACCEPTED", "PREPARING", "READY", "SERVED"],
      },
      lowStockAlertEnabled: { type: Boolean, default: true },
      enforceStock: { type: Boolean, default: false },
    },
    loyaltySettings: {
      pointsPerCurrencyUnit: { type: Number, min: 0 },
      currencyPerPoint: { type: Number, min: 0 },
      enabled: { type: Boolean, default: false },
    },
    orderSettings: {
      customerOrderingMode: { type: String, enum: ["OFF", "CAPTAIN_APPROVAL", "AUTOMATIC"], default: "CAPTAIN_APPROVAL" },
      qrRequiresCaptainApproval: { type: Boolean, default: true },
    },
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
    kitchenStation: {
      type: String,
      enum: ["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"],
    },
    taxRatePercent: { type: Number, min: 0, max: 100 },
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
    variants: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true, min: 0 },
            isAvailable: { type: Boolean, default: true },
            sortOrder: { type: Number, default: 0 },
            sku: String,
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
    sku: { type: String, trim: true, maxlength: 64 },
    kitchenStation: {
      type: String,
      enum: ["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"],
    },
    taxRatePercent: { type: Number, min: 0, max: 100, default: undefined },
    createdAt: String,
    updatedAt: String,
  },
  { ...baseOptions, collection: "dishes" },
);
dishSchema.index({ restaurantId: 1, sku: 1 }, { sparse: true });

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
    locationType: { type: String, enum: ["TABLE", "ROOM"], required: true, default: "TABLE" },
    tableNumber: { type: Number, required: true, min: 1 },
    label: String,
    capacity: { type: Number, min: 1 },
    reservationRevision: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, required: true, default: true },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "OCCUPIED", "BILL_REQUESTED", "PAYMENT_PENDING", "CLEANING", "CLOSED"],
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
    lineId: String,
    dishId: { type: String, required: true },
    dishNameSnapshot: { type: String, required: true },
    variantId: String,
    variantNameSnapshot: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPriceSnapshot: { type: Number, required: true, min: 0 },
    addons: { type: [orderAddonSnapshotSchema], default: [] },
    itemDiscountAmount: { type: Number, min: 0 },
    note: { type: String, maxlength: 500 },
    kitchenStation: {
      type: String,
      enum: ["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"],
    },
    preparationStatus: {
      type: String,
      enum: ["QUEUED", "PREPARING", "READY"],
      default: "QUEUED",
    },
    itemTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: true },
);

const paymentAuditEventSchema = new Schema(
  {
    eventId: { type: String, required: true },
    action: {
      type: String,
      enum: ["RECORD", "PARTIAL", "CORRECTION", "REVERSAL", "REFUND"],
      required: true,
    },
    previousStatus: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PARTIAL", "PAID", "REFUNDED"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PARTIAL", "PAID", "REFUNDED"],
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

const paymentLedgerEntrySchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["CHARGE", "REFUND"], required: true },
    method: { type: String, enum: ["CASH", "UPI", "CARD"], required: true },
    amount: { type: Number, required: true, min: 0 },
    recordedAt: { type: String, required: true },
    recordedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    reason: String,
  },
  { _id: false, strict: true },
);

const paymentSummarySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["NOT_RECORDED", "UNPAID", "PARTIAL", "PAID", "REFUNDED"],
      required: true,
      default: "UNPAID",
    },
    method: {
      type: String,
      enum: ["CASH", "UPI", "CARD"],
    },
    amount: { type: Number, min: 0 },
    amountPaid: { type: Number, min: 0 },
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
    ledger: { type: [paymentLedgerEntrySchema], default: [] },
  },
  { _id: false, strict: true },
);

const orderSchema = new Schema<RestaurantOrder>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true },
    tableId: { type: String, required: true },
    tableNumber: { type: Number, required: true },
    tableSessionId: { type: String, index: true },
    locationType: { type: String, enum: ["TABLE", "ROOM"] },
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
        "COMPLETED",
        "CANCELLED",
        "REJECTED",
        "REFUNDED",
      ],
      required: true,
      default: "PENDING",
    },
    channel: {
      type: String,
      enum: ["QR", "POS_DINE_IN", "POS_TAKEAWAY", "POS_DELIVERY"],
      default: "QR",
    },
    source: { type: String, enum: ["QR", "POS", "CAPTAIN"], default: "QR" },
    guestCount: { type: Number, min: 1 },
    orderNote: { type: String, maxlength: 1000 },
    captainAuthorization: {
      status: {
        type: String,
        enum: [
          "PENDING_CAPTAIN_APPROVAL",
          "CAPTAIN_APPROVED",
          "REJECTED",
          "CORRECTION_REQUESTED",
          "NOT_REQUIRED",
        ],
      },
      entrySource: { type: String, enum: ["CAPTAIN_DIRECT", "CUSTOMER_QR", "POS"] },
      authorizedCaptainId: String,
      authorizedCaptainName: String,
      authorizedAt: String,
      decisionReason: String,
      decisionIdempotencyKey: String,
    },
    items: { type: [orderItemSnapshotSchema], required: true },
    kotLineIds: { type: [String], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    billDiscountAmount: { type: Number, min: 0, default: 0 },
    couponCodeSnapshot: String,
    couponDiscountAmount: { type: Number, min: 0 },
    loyaltyPointsRedeemed: { type: Number, min: 0 },
    customerId: String,
    taxRatePercent: { type: Number, min: 0, max: 100 },
    taxAmount: { type: Number, min: 0, default: 0 },
    packagingCharge: { type: Number, min: 0, default: 0 },
    serviceCharge: { type: Number, min: 0, default: 0 },
    cgstAmount: { type: Number, min: 0, default: 0 },
    sgstAmount: { type: Number, min: 0, default: 0 },
    igstAmount: { type: Number, min: 0, default: 0 },
    billSnapshot: { type: Schema.Types.Mixed },
    total: { type: Number, required: true, min: 0 },
    payment: {
      type: paymentSummarySchema,
      required: true,
      default: () => ({ status: "UNPAID", auditTrail: [], ledger: [], amountPaid: 0 }),
    },
    events: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            type: {
              type: String,
              enum: [
                "CREATED",
                "STATUS_CHANGED",
                "PAYMENT",
                "NOTE",
                "ITEM_PREP",
                "RECEIPT_REPRINT",
                "REFUND",
                "LINE_CANCELLED",
                "CAPTAIN_AUTHORIZATION",
              ],
              required: true,
            },
            at: { type: String, required: true },
            actor: {
              role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"] },
              id: String,
              email: String,
              name: String,
            },
            message: { type: String, required: true },
            meta: Schema.Types.Mixed,
          },
          { _id: false, strict: true },
        ),
      ],
      default: [],
    },
    shiftId: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    completedAt: String,
  },
  { ...baseOptions, collection: "orders" },
);
orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, customerId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, tableSessionId: 1, createdAt: 1 });

const tableSessionSchema = new Schema<TableSession>(
  {
    id: { type: String, required: true, unique: true, index: true },
    sessionNumber: { type: String, required: true },
    organizationId: { type: String, index: true },
    restaurantId: { type: String, required: true, index: true },
    serviceLocationId: { type: String, required: true, index: true },
    tableNumberSnapshot: { type: Number, required: true },
    locationType: { type: String, enum: ["TABLE", "ROOM"], required: true },
    status: { type: String, enum: ["ACTIVE", "BILLING", "PAYMENT_PENDING", "CLOSED", "CANCELLED"], required: true, default: "ACTIVE" },
    billingStatus: { type: String, enum: ["OPEN", "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"], required: true, default: "OPEN" },
    openedAt: { type: String, required: true },
    openedBy: { type: Schema.Types.Mixed, required: true },
    closedAt: String,
    closedBy: Schema.Types.Mixed,
    guestCount: { type: Number, min: 1 },
    customerReference: String,
    version: { type: Number, required: true, default: 1, min: 1 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "tableSessions" },
);
tableSessionSchema.index({ restaurantId: 1, sessionNumber: 1 }, { unique: true });
tableSessionSchema.index(
  { restaurantId: 1, serviceLocationId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["ACTIVE", "BILLING", "PAYMENT_PENDING"] } } },
);

const masterBillSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    billNumber: { type: String, required: true },
    organizationId: { type: String, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableSessionId: { type: String, required: true, index: true },
    serviceLocationId: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["ISSUED", "PARTIALLY_PAID", "PAID", "VOID", "SUPERSEDED"], required: true },
    orderIds: { type: [String], required: true },
    lines: { type: [Schema.Types.Mixed], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    packagingCharge: { type: Number, required: true, min: 0 },
    serviceCharge: { type: Number, required: true, min: 0 },
    tipAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0 },
    outstandingAmount: { type: Number, required: true, min: 0 },
    fingerprint: { type: String, required: true },
    splitMode: { type: String, enum: ["NONE", "EQUAL", "ITEMS", "CUSTOM"], required: true, default: "NONE" },
    allocations: { type: [Schema.Types.Mixed], default: [] },
    paymentLedger: { type: [Schema.Types.Mixed], default: [] },
    issuedAt: { type: String, required: true },
    issuedBy: { type: Schema.Types.Mixed, required: true },
    supersededAt: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "masterBills" },
);
masterBillSchema.index({ restaurantId: 1, tableSessionId: 1, version: 1 }, { unique: true });
masterBillSchema.index({ restaurantId: 1, billNumber: 1 }, { unique: true });

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
    employeeCode: { type: String, trim: true, maxlength: 40 },
    assignedTableIds: { type: [String], default: [] },
    permissions: {
      viewBill: { type: Boolean },
      requestBill: { type: Boolean },
      recordCashPayment: { type: Boolean },
      recordUpiPayment: { type: Boolean },
      recordCardPayment: { type: Boolean },
      applyCoupon: { type: Boolean },
      applyDiscount: { type: Boolean },
      printReceipt: { type: Boolean },
      maxDiscountPercent: { type: Number, min: 0, max: 100 },
      maxDiscountAmount: { type: Number, min: 0 },
    },
    lastActiveAt: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "captains" },
);
captainSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
captainSchema.index({ restaurantId: 1, assignedTableIds: 1 });

const captainTableAssignmentEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    captainId: { type: String, required: true, index: true },
    tableIdsAdded: { type: [String], default: [] },
    tableIdsRemoved: { type: [String], default: [] },
    resultingTableIds: { type: [String], default: [] },
    changedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "SUPER_ADMIN"], required: true },
      id: { type: String, required: true },
      email: String,
    },
    note: { type: String, maxlength: 300 },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "captainTableAssignmentEvents" },
);
captainTableAssignmentEventSchema.index({ restaurantId: 1, createdAt: -1 });
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
    organizationId: { type: String, index: true },
    orgRole: {
      type: String,
      enum: ["ORG_OWNER", "ORG_ADMIN", "OUTLET_MANAGER", "OUTLET_STAFF"],
    },
    outletIds: { type: [String], default: undefined },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "restaurantAdminAccounts" },
);
restaurantAdminAccountSchema.index({ restaurantId: 1 }, { unique: true });
restaurantAdminAccountSchema.index({ organizationId: 1, orgRole: 1 });
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

const posShiftSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    openedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    openedAt: { type: String, required: true },
    openingFloat: { type: Number, required: true, min: 0 },
    closedAt: String,
    closedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"] },
      id: String,
      email: String,
      name: String,
    },
    closingCashCounted: { type: Number, min: 0 },
    expectedCash: { type: Number, min: 0 },
    notes: { type: String, maxlength: 1000 },
    status: { type: String, enum: ["OPEN", "CLOSED"], required: true, default: "OPEN" },
  },
  { ...baseOptions, collection: "posShifts" },
);
posShiftSchema.index({ restaurantId: 1, status: 1 });

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
export const TableSessionModel =
  mongoose.models.TableSession ??
  mongoose.model<TableSession>("TableSession", tableSessionSchema);
export const MasterBillModel =
  mongoose.models.MasterBill ??
  mongoose.model<MasterBill>("MasterBill", masterBillSchema);
export const OrderCounterModel =
  mongoose.models.OrderCounter ??
  mongoose.model("OrderCounter", orderCounterSchema);
export const CaptainModel =
  mongoose.models.Captain ??
  mongoose.model<Captain>("Captain", captainSchema);
export const CaptainTableAssignmentEventModel =
  mongoose.models.CaptainTableAssignmentEvent ??
  mongoose.model("CaptainTableAssignmentEvent", captainTableAssignmentEventSchema);
export const RestaurantAdminAccountModel =
  mongoose.models.RestaurantAdminAccount ??
  mongoose.model<RestaurantAdminAccount>("RestaurantAdminAccount", restaurantAdminAccountSchema);
export const ReservationModel =
  mongoose.models.Reservation ??
  mongoose.model<Reservation>("Reservation", reservationSchema);
export const PosShiftModel =
  mongoose.models.PosShift ?? mongoose.model("PosShift", posShiftSchema);

const receiptReprintLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: Number, required: true },
    reprintedAt: { type: String, required: true },
    reprintedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    reason: { type: String, maxlength: 300 },
  },
  { ...baseOptions, collection: "receiptReprintLogs" },
);
receiptReprintLogSchema.index({ restaurantId: 1, orderId: 1, reprintedAt: -1 });

export const ReceiptReprintLogModel =
  mongoose.models.ReceiptReprintLog ??
  mongoose.model("ReceiptReprintLog", receiptReprintLogSchema);

const serviceRequestSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableId: { type: String, required: true, index: true },
    tableNumber: { type: Number, required: true },
    captainId: String,
    type: {
      type: String,
      enum: [
        "WATER",
        "EXTRA_PLATES",
        "CUTLERY",
        "NAPKINS",
        "ASSISTANCE",
        "CLEANING",
        "BILL",
        "OTHER",
      ],
      required: true,
    },
    note: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "DONE", "CANCELLED"],
      required: true,
      default: "OPEN",
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    completedAt: String,
  },
  { ...baseOptions, collection: "serviceRequests" },
);
serviceRequestSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
serviceRequestSchema.index({ restaurantId: 1, tableId: 1, status: 1 });

export const ServiceRequestModel =
  mongoose.models.ServiceRequest ?? mongoose.model("ServiceRequest", serviceRequestSchema);

const billingAuditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    action: { type: String, enum: ["SETTINGS_SAVE", "BULK_TAX_APPLY"], required: true },
    previous: Schema.Types.Mixed,
    next: Schema.Types.Mixed,
    meta: Schema.Types.Mixed,
    actor: {
      id: { type: String, required: true },
      email: String,
      role: { type: String, required: true },
    },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "billingAudits" },
);
billingAuditSchema.index({ restaurantId: 1, createdAt: -1 });

export const BillingAuditModel =
  mongoose.models.BillingAudit ?? mongoose.model("BillingAudit", billingAuditSchema);

const inventoryUnitEnum = ["g", "kg", "ml", "l", "pcs", "dozen"] as const;

const organizationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "organizations" },
);

const ingredientSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    name: { type: String, required: true },
    sku: String,
    baseUnit: { type: String, required: true, enum: inventoryUnitEnum },
    conversions: { type: Schema.Types.Mixed, default: {} },
    quantityOnHand: { type: Number, required: true, default: 0 },
    reorderLevel: Number,
    reorderQuantity: Number,
    averageUnitCost: Number,
    lastPurchaseUnitCost: Number,
    expiryDate: String,
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "ingredients" },
);
ingredientSchema.index({ restaurantId: 1, name: 1 });

const recipeSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    dishId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    yieldPortions: { type: Number, required: true, min: 1, default: 1 },
    lines: {
      type: [
        {
          ingredientId: { type: String, required: true },
          quantity: { type: Number, required: true, min: 0 },
          unit: { type: String, required: true, enum: inventoryUnitEnum },
        },
      ],
      default: [],
    },
    estimatedCostPerPortion: Number,
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "recipes" },
);
recipeSchema.index({ restaurantId: 1, dishId: 1 }, { unique: true });

const inventoryMovementSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    ingredientId: { type: String, required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: [
        "PURCHASE_RECEIPT",
        "SALE_CONSUMPTION",
        "ADJUSTMENT",
        "WASTAGE",
        "TRANSFER_OUT",
        "TRANSFER_IN",
        "RECONCILIATION",
        "RESTORE_CANCEL",
      ],
    },
    quantityDelta: { type: Number, required: true },
    unitCost: Number,
    balanceAfter: { type: Number, required: true },
    referenceType: String,
    referenceId: String,
    idempotencyKey: { type: String, required: true },
    note: String,
    actor: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"] },
      id: String,
      email: String,
      name: String,
    },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "inventoryMovements" },
);
inventoryMovementSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });
inventoryMovementSchema.index({ restaurantId: 1, kind: 1, createdAt: -1 });

const inventoryConsumptionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["CONSUMED", "RESTORED", "PARTIALLY_RESTORED", "BLOCKED_NO_RESTORE"],
      required: true,
    },
    lines: {
      type: [
        {
          ingredientId: String,
          quantityBase: Number,
          movementId: String,
          orderLineId: String,
          restoredQuantityBase: { type: Number, min: 0, default: 0 },
        },
      ],
      default: [],
    },
    reason: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "inventoryConsumptions" },
);
inventoryConsumptionSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });

const supplierSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    name: { type: String, required: true },
    contactName: String,
    phone: String,
    email: String,
    address: String,
    notes: String,
    leadTimeDays: { type: Number, min: 0 },
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "suppliers" },
);

const purchaseOrderSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"],
      required: true,
      default: "DRAFT",
    },
    orderNumber: { type: Number, required: true },
    lines: {
      type: [
        {
          ingredientId: { type: String, required: true },
          nameSnapshot: { type: String, required: true },
          quantity: { type: Number, required: true, min: 0 },
          unit: { type: String, required: true, enum: inventoryUnitEnum },
          unitCost: { type: Number, required: true, min: 0 },
          receivedQuantity: { type: Number, required: true, default: 0, min: 0 },
        },
      ],
      default: [],
    },
    expectedAt: String,
    notes: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    receivedAt: String,
  },
  { ...baseOptions, collection: "purchaseOrders" },
);
purchaseOrderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });

const goodsReceiptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    purchaseOrderId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true },
    lines: {
      type: [
        {
          ingredientId: String,
          quantity: Number,
          unit: { type: String, enum: inventoryUnitEnum },
          unitCost: Number,
        },
      ],
      default: [],
    },
    receivedAt: { type: String, required: true },
    receivedBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    invoiceNumber: String,
    notes: String,
  },
  { ...baseOptions, collection: "goodsReceipts" },
);

const customerProfileSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    phone: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    name: String,
    passwordHash: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: String,
    segment: { type: String, enum: ["NEW", "REGULAR", "VIP", "LAPSED"] },
    loyaltyPoints: { type: Number, required: true, default: 0 },
    totalOrders: { type: Number, required: true, default: 0 },
    totalSpend: { type: Number, required: true, default: 0 },
    marketingOptIn: { type: Boolean, default: false },
    smsOptIn: { type: Boolean, default: false },
    emailOptIn: { type: Boolean, default: false },
    lastOrderAt: String,
    notes: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "customerProfiles" },
);
customerProfileSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });
customerProfileSchema.index(
  { restaurantId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

const loyaltyTransactionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    kind: { type: String, enum: ["EARN", "REDEEM", "ADJUST", "EXPIRE"], required: true },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    orderId: String,
    couponId: String,
    idempotencyKey: { type: String, required: true },
    note: String,
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "loyaltyTransactions" },
);
loyaltyTransactionSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });

const couponSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    description: String,
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderTotal: Number,
    maxRedemptions: Number,
    redemptionCount: { type: Number, required: true, default: 0 },
    pointsCost: Number,
    startsAt: String,
    endsAt: String,
    isActive: { type: Boolean, required: true, default: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "coupons" },
);
couponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

const couponRedemptionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    couponId: { type: String, required: true, index: true },
    codeSnapshot: { type: String, required: true },
    orderId: String,
    customerId: String,
    discountAmount: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["RESERVED", "CONFIRMED", "RELEASED"],
      required: true,
      default: "RESERVED",
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "couponRedemptions" },
);
couponRedemptionSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });

const accessAssignmentAuditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantAdminAccountId: { type: String, required: true, index: true },
    organizationId: String,
    previous: { type: Schema.Types.Mixed, required: true },
    next: { type: Schema.Types.Mixed, required: true },
    changedBy: {
      role: { type: String, enum: ["SUPER_ADMIN"], required: true },
      email: { type: String, required: true },
    },
    reason: String,
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "accessAssignmentAudits" },
);

const orderLineCancellationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderLineId: { type: String, required: true },
    quantityCancelled: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, maxlength: 500 },
    inventoryRestoreStatus: {
      type: String,
      enum: ["RESTORED", "BLOCKED", "NONE"],
      required: true,
    },
    idempotencyKey: { type: String, required: true },
    actor: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "orderLineCancellations" },
);
orderLineCancellationSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });

const customerFeedbackSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    customerId: String,
    orderId: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 2000 },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "customerFeedback" },
);

const stockTransferSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    fromRestaurantId: { type: String, required: true },
    toRestaurantId: { type: String, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "RECEIVED", "CANCELLED"],
      required: true,
      default: "DRAFT",
    },
    lines: {
      type: [
        {
          ingredientId: String,
          quantity: Number,
          unit: { type: String, enum: inventoryUnitEnum },
        },
      ],
      default: [],
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    receivedAt: String,
  },
  { ...baseOptions, collection: "stockTransfers" },
);

export const OrganizationModel =
  mongoose.models.Organization ?? mongoose.model("Organization", organizationSchema);
export const IngredientModel =
  mongoose.models.Ingredient ?? mongoose.model("Ingredient", ingredientSchema);
export const RecipeModel =
  mongoose.models.Recipe ?? mongoose.model("Recipe", recipeSchema);
export const InventoryMovementModel =
  mongoose.models.InventoryMovement ??
  mongoose.model("InventoryMovement", inventoryMovementSchema);
export const InventoryConsumptionModel =
  mongoose.models.InventoryConsumption ??
  mongoose.model("InventoryConsumption", inventoryConsumptionSchema);
export const SupplierModel =
  mongoose.models.Supplier ?? mongoose.model("Supplier", supplierSchema);
export const PurchaseOrderModel =
  mongoose.models.PurchaseOrder ?? mongoose.model("PurchaseOrder", purchaseOrderSchema);
export const GoodsReceiptModel =
  mongoose.models.GoodsReceipt ?? mongoose.model("GoodsReceipt", goodsReceiptSchema);
export const CustomerProfileModel =
  mongoose.models.CustomerProfile ??
  mongoose.model("CustomerProfile", customerProfileSchema);
export const LoyaltyTransactionModel =
  mongoose.models.LoyaltyTransaction ??
  mongoose.model("LoyaltyTransaction", loyaltyTransactionSchema);
export const CouponModel =
  mongoose.models.Coupon ?? mongoose.model("Coupon", couponSchema);
export const CouponRedemptionModel =
  mongoose.models.CouponRedemption ??
  mongoose.model("CouponRedemption", couponRedemptionSchema);
export const AccessAssignmentAuditModel =
  mongoose.models.AccessAssignmentAudit ??
  mongoose.model("AccessAssignmentAudit", accessAssignmentAuditSchema);
export const OrderLineCancellationModel =
  mongoose.models.OrderLineCancellation ??
  mongoose.model("OrderLineCancellation", orderLineCancellationSchema);
export const CustomerFeedbackModel =
  mongoose.models.CustomerFeedback ??
  mongoose.model("CustomerFeedback", customerFeedbackSchema);
export const StockTransferModel =
  mongoose.models.StockTransfer ?? mongoose.model("StockTransfer", stockTransferSchema);

const menuSyncJobSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    sourceRestaurantId: { type: String, required: true },
    targetRestaurantIds: { type: [String], required: true },
    status: {
      type: String,
      enum: ["DRAFT", "PREVIEW", "PUBLISHED", "ROLLED_BACK"],
      required: true,
      default: "DRAFT",
    },
    preserveBranchFields: {
      type: [String],
      default: ["price", "isAvailable", "sortOrder", "kitchenStation"],
    },
    snapshotSummary: String,
    prePublishSnapshots: { type: [Schema.Types.Mixed], default: [] },
    publishFingerprints: { type: [Schema.Types.Mixed], default: [] },
    rollbackPreview: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    publishedAt: String,
    rolledBackAt: String,
    createdBy: {
      role: { type: String, enum: ["RESTAURANT_ADMIN", "CAPTAIN"], required: true },
      id: { type: String, required: true },
      email: String,
      name: String,
    },
  },
  { ...baseOptions, collection: "menuSyncJobs" },
);
menuSyncJobSchema.index({ organizationId: 1, createdAt: -1 });

export const MenuSyncJobModel =
  mongoose.models.MenuSyncJob ?? mongoose.model("MenuSyncJob", menuSyncJobSchema);

const aiForecastRunSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    horizon: { type: String, enum: ["TOMORROW", "NEXT_7_DAYS", "NEXT_30_DAYS"], required: true },
    modelVersion: { type: String, required: true },
    inputFrom: { type: String, required: true },
    inputTo: { type: String, required: true },
    generatedAt: { type: String, required: true },
    figuresSource: {
      type: String,
      enum: ["ACTUAL", "ESTIMATED", "INSUFFICIENT_DATA"],
      required: true,
    },
    points: { type: [Schema.Types.Mixed], default: [] },
    note: String,
  },
  { ...baseOptions, collection: "aiForecastRuns" },
);
aiForecastRunSchema.index({ restaurantId: 1, horizon: 1, generatedAt: -1 });

const aiAlertSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    type: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], required: true },
    status: {
      type: String,
      enum: ["NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
      required: true,
      default: "NEW",
    },
    detectionFrom: { type: String, required: true },
    detectionTo: { type: String, required: true },
    supportingData: { type: Schema.Types.Mixed, default: {} },
    reason: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    acknowledgedAt: String,
    resolvedAt: String,
  },
  { ...baseOptions, collection: "aiAlerts" },
);
aiAlertSchema.index({ restaurantId: 1, dedupeKey: 1 }, { unique: true });
aiAlertSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

const aiUsageEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: String,
    accountId: { type: String, required: true, index: true },
    route: { type: String, required: true },
    provider: String,
    model: String,
    promptTokens: Number,
    completionTokens: Number,
    estimatedCostUsd: Number,
    createdAt: { type: String, required: true, index: true },
  },
  { ...baseOptions, collection: "aiUsageEvents" },
);

const aiAssistantThreadSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    accountId: { type: String, required: true, index: true },
    messages: {
      type: [
        {
          role: { type: String, enum: ["user", "assistant"], required: true },
          content: { type: String, required: true },
          at: { type: String, required: true },
          toolName: String,
        },
      ],
      default: [],
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "aiAssistantThreads" },
);
aiAssistantThreadSchema.index({ restaurantId: 1, accountId: 1, updatedAt: -1 });

export const AiForecastRunModel =
  mongoose.models.AiForecastRun ?? mongoose.model("AiForecastRun", aiForecastRunSchema);
export const AiAlertModel =
  mongoose.models.AiAlert ?? mongoose.model("AiAlert", aiAlertSchema);
export const AiUsageEventModel =
  mongoose.models.AiUsageEvent ?? mongoose.model("AiUsageEvent", aiUsageEventSchema);
export const AiAssistantThreadModel =
  mongoose.models.AiAssistantThread ??
  mongoose.model("AiAssistantThread", aiAssistantThreadSchema);

const hardwareDeviceSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    deviceType: {
      type: String,
      required: true,
      enum: [
        "RECEIPT_PRINTER",
        "KITCHEN_PRINTER",
        "CASH_DRAWER",
        "BARCODE_SCANNER",
        "CUSTOMER_DISPLAY",
        "PAYMENT_TERMINAL",
      ],
    },
    manufacturer: { type: String, required: true },
    model: { type: String, required: true },
    connectionType: {
      type: String,
      required: true,
      enum: ["SIMULATOR", "NETWORK", "USB", "BLUETOOTH", "KEYBOARD_WEDGE", "LOCAL_CONNECTOR"],
    },
    adapterType: {
      type: String,
      required: true,
      enum: ["SIMULATOR", "ESC_POS", "CONNECTOR", "SDK"],
    },
    connectionStatus: {
      type: String,
      required: true,
      enum: ["CONNECTED", "DISCONNECTED", "CONNECTING", "ERROR", "DISABLED"],
    },
    healthStatus: {
      type: String,
      required: true,
      enum: ["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"],
    },
    lastSeenAt: String,
    capabilities: { type: [String], default: [] },
    configuration: { type: Schema.Types.Mixed, default: {} },
    simulated: { type: Boolean, required: true, default: true },
    enabled: { type: Boolean, required: true, default: true },
    kitchenStation: String,
    printerRole: {
      type: String,
      enum: ["RECEIPT", "KITCHEN", "BAR", "SECONDARY_RECEIPT", "OTHER"],
    },
    lastSuccessfulJobAt: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "hardwareDevices" },
);
hardwareDeviceSchema.index({ restaurantId: 1, outletId: 1, deviceType: 1 });
hardwareDeviceSchema.index({ restaurantId: 1, outletId: 1, printerRole: 1 });
hardwareDeviceSchema.index({ "configuration.connectorId": 1 });

const printJobSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    orderId: { type: String, index: true },
    jobType: {
      type: String,
      required: true,
      enum: ["RECEIPT", "BILL", "KOT", "KOT_CANCEL", "KOT_MODIFY", "REPRINT_RECEIPT", "REPRINT_KOT", "TEST_PAGE"],
    },
    dedupeKey: { type: String, required: true, index: true },
    payloadSnapshot: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: [
        "QUEUED",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "UNKNOWN",
        "MANUAL_REVIEW",
      ],
      index: true,
    },
    attemptCount: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true, default: 3 },
    isReprint: { type: Boolean, required: true, default: false },
    simulated: { type: Boolean, required: true, default: true },
    errorMessage: String,
    connectorId: { type: String, index: true },
    payloadHash: String,
    correlationId: String,
    leaseConnectorId: { type: String, index: true },
    leaseExpiresAt: { type: String, index: true },
    createdAt: { type: String, required: true, index: true },
    updatedAt: { type: String, required: true },
    completedAt: String,
  },
  { ...baseOptions, collection: "printJobs" },
);
printJobSchema.index({ restaurantId: 1, dedupeKey: 1 }, { unique: true });
printJobSchema.index({ status: 1, leaseExpiresAt: 1 });

const deviceEventSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    simulated: { type: Boolean, required: true, default: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: String, required: true, index: true },
    actorId: String,
  },
  { ...baseOptions, collection: "deviceEvents" },
);
deviceEventSchema.index({ restaurantId: 1, deviceId: 1, createdAt: -1 });

export const HardwareDeviceModel =
  mongoose.models.HardwareDevice ?? mongoose.model("HardwareDevice", hardwareDeviceSchema);
export const PrintJobModel =
  mongoose.models.PrintJob ?? mongoose.model("PrintJob", printJobSchema);
export const DeviceEventModel =
  mongoose.models.DeviceEvent ?? mongoose.model("DeviceEvent", deviceEventSchema);

const deviceConnectorSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    name: { type: String, required: true },
    credentialHash: { type: String, required: true },
    credentialVersion: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      required: true,
      enum: ["ONLINE", "OFFLINE", "REVOKED", "PAIRING"],
      index: true,
    },
    version: String,
    hostname: String,
    lastHeartbeatAt: String,
    lastSeenAt: String,
    pairedAt: { type: String, required: true },
    revokedAt: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "deviceConnectors" },
);
deviceConnectorSchema.index({ restaurantId: 1, outletId: 1 });

const connectorPairingCodeSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    codeHash: { type: String, required: true, index: true },
    expiresAt: { type: String, required: true, index: true },
    usedAt: String,
    createdBy: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "connectorPairingCodes" },
);

export const DeviceConnectorModel =
  mongoose.models.DeviceConnector ?? mongoose.model("DeviceConnector", deviceConnectorSchema);
export const ConnectorPairingCodeModel =
  mongoose.models.ConnectorPairingCode ??
  mongoose.model("ConnectorPairingCode", connectorPairingCodeSchema);

const dynamicPaymentRequestSchema = new Schema<DynamicPaymentRequest>(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    outletId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    tableSessionId: { type: String, index: true },
    billId: { type: String, index: true },
    billVersion: Number,
    paymentReferenceId: { type: String, required: true, unique: true, index: true },
    merchantAccountId: { type: String, required: true },
    provider: { type: String, required: true, enum: ["RAZORPAY"] },
    providerQrId: { type: String, required: true, unique: true, index: true },
    qrImageUrl: String,
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true, enum: ["INR"] },
    status: {
      type: String,
      required: true,
      enum: ["CREATING", "PROCESSING", "PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "PARTIAL", "WRONG_AMOUNT"],
      index: true,
    },
    expiresAt: { type: String, required: true, index: true },
    providerPaymentId: String,
    providerEventIds: { type: [String], default: [] },
    failureReason: String,
    createdAt: { type: String, required: true, index: true },
    updatedAt: { type: String, required: true },
  },
  { ...baseOptions, collection: "dynamicPaymentRequests" },
);
dynamicPaymentRequestSchema.index({ restaurantId: 1, orderId: 1, status: 1 });

export const DynamicPaymentRequestModel =
  mongoose.models.DynamicPaymentRequest ?? mongoose.model("DynamicPaymentRequest", dynamicPaymentRequestSchema);

const hardwarePilotRunSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    outletId: { type: String, required: true },
    connectorId: String,
    deviceId: String,
    deviceModel: String,
    osVersion: String,
    connectorVersion: String,
    performedBy: { type: String, required: true },
    steps: { type: Schema.Types.Mixed, default: [] },
    overallStatus: {
      type: String,
      enum: ["IN_PROGRESS", "PASSED", "FAILED", "PARTIAL", "NOT_PHYSICALLY_RUN"],
      required: true,
    },
    notes: String,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    completedAt: String,
  },
  { ...baseOptions, collection: "hardwarePilotRuns" },
);

export const HardwarePilotRunModel =
  mongoose.models.HardwarePilotRun ?? mongoose.model("HardwarePilotRun", hardwarePilotRunSchema);
