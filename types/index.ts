// User & Authentication Roles
export type UserRole = "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CAPTAIN";

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  restaurantId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Captain = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordCiphertext?: string;
  passwordIv?: string;
  passwordAuthTag?: string;
  isActive: boolean;
  /** Optional staff / employee code shown in admin (not required). */
  employeeCode?: string;
  /** Table document ids assigned to this captain. Configurable; never hard-capped. */
  assignedTableIds?: string[];
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CaptainView = Omit<Captain, "passwordHash" | "passwordCiphertext" | "passwordIv" | "passwordAuthTag"> & {
  passwordConfigured: boolean;
};

export type CaptainTableAssignmentEvent = {
  id: string;
  restaurantId: string;
  captainId: string;
  tableIdsAdded: string[];
  tableIdsRemoved: string[];
  resultingTableIds: string[];
  changedBy: { role: "RESTAURANT_ADMIN" | "SUPER_ADMIN"; id: string; email?: string };
  note?: string;
  createdAt: string;
};

/** Organization / outlet RBAC (Phase 4.1). Additive — legacy admins without orgRole keep single-outlet access. */
export type OrgRole = "ORG_OWNER" | "ORG_ADMIN" | "OUTLET_MANAGER" | "OUTLET_STAFF";

export type RestaurantAdminAccount = {
  id: string;
  restaurantId: string;
  email: string;
  passwordHash: string;
  passwordCiphertext?: string;
  passwordIv?: string;
  passwordAuthTag?: string;
  isActive: boolean;
  /** When set, admin belongs to an organization for multi-outlet RBAC. */
  organizationId?: string;
  orgRole?: OrgRole;
  /** For OUTLET_MANAGER / OUTLET_STAFF: allowed restaurant (outlet) ids. Empty/undefined with ORG_* = all org outlets. */
  outletIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type RestaurantAdminCredentialStatus = {
  restaurantId: string;
  email: string | null;
  isActive: boolean | null;
  passwordConfigured: boolean;
  credentialSource: "DATABASE" | "LEGACY_ENV" | "NONE";
  needsPasswordSetup: boolean;
  databaseAccountExists: boolean;
  databaseLoginReady: boolean;
  legacyFallbackRequired: boolean;
  encryptionKeyStatus: "READY" | "MISSING" | "INVALID";
  readiness:
    | "NO_DATABASE_ACCOUNT"
    | "LEGACY_FALLBACK_REQUIRED"
    | "DATABASE_LOGIN_CONFIGURATION_INVALID"
    | "DATABASE_ACCOUNT_INACTIVE"
    | "RESTAURANT_INACTIVE"
    | "DATABASE_PASSWORD_RECORD_INCOMPLETE"
    | "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE"
    | "DATABASE_LOGIN_READY_ENCRYPTION_KEY_MISSING"
    | "DATABASE_LOGIN_READY_ENCRYPTION_KEY_INVALID"
    | "DATABASE_LOGIN_AND_RECOVERY_CHECK_REQUIRED";
};

export type RestaurantAdminCredentialVerification = {
  verified: boolean;
  result:
    | "VERIFIED_DATABASE_LOGIN_AND_RECOVERY"
    | "NO_DATABASE_ACCOUNT"
    | "INVALID_PASSWORD_HASH"
    | "ACCOUNT_INACTIVE"
    | "RESTAURANT_INACTIVE"
    | "PASSWORD_NOT_RECOVERABLE"
    | "ENCRYPTION_KEY_MISSING"
    | "ENCRYPTION_KEY_INVALID"
    | "STORED_CREDENTIALS_DO_NOT_MATCH";
};

export type RestaurantSocialLinks = {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  website?: string;
};

export type RestaurantWifiSecurity = "WPA2" | "WPA3" | "OPEN";

/** Stored Wi-Fi secrets are encrypted with a server-side key. Never serialize this object to a client. */
export type RestaurantWifiConfiguration = {
  ssid: string;
  security: RestaurantWifiSecurity;
  passwordCiphertext?: string;
  passwordIv?: string;
  passwordAuthTag?: string;
};

// Restaurant Theme/Branding
export type RestaurantTheme = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonStyle?: "filled" | "outlined" | "gradient";
  borderRadius?: "sharp" | "rounded" | "pill";
};

// Subscription Plans
export type SubscriptionPlan = "STARTER" | "PRO" | "ENTERPRISE";

// Subscription Status
export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELLED";

// Feature Keys
export type FeatureKey =
  | "VIDEO_MENU"
  | "TABLE_MANAGEMENT"
  | "TABLE_ORDERING"
  | "ORDER_MANAGEMENT"
  | "MEDIA_LIBRARY"
  | "RESERVATIONS"
  | "CAPTAIN_ACCESS"
  | "WIFI"
  | "CUSTOM_THEME"
  | "ANALYTICS"
  | "MENU_IMPORT"
  | "POS"
  | "KITCHEN_DISPLAY"
  | "INVENTORY"
  | "PROCUREMENT"
  | "CRM_LOYALTY"
  | "MULTI_OUTLET"
  | "AI_BUSINESS_ASSISTANT"
  | "AI_SALES_FORECAST"
  | "AI_INVENTORY_INTELLIGENCE"
  | "AI_MENU_INTELLIGENCE"
  | "AI_OPERATIONAL_ALERTS"
  | "HARDWARE_SIMULATOR"
  | "HARDWARE_PRINTING"
  | "HARDWARE_CASH_DRAWER"
  | "HARDWARE_BARCODE"
  | "HARDWARE_PAYMENT_TERMINAL"
  | "HARDWARE_CUSTOMER_DISPLAY"
  | "HARDWARE_LOCAL_CONNECTOR";

export type KitchenStation = "MAIN" | "BAR" | "BAKERY" | "DESSERT" | "OTHER";

export type GstSupplyType = "INTRA_STATE" | "INTER_STATE";
export type TaxPriceMode = "EXCLUSIVE" | "INCLUSIVE";

export type PackagingChargeMethod = "PER_ORDER" | "PER_ITEM" | "PER_QUANTITY" | "PERCENT_OF_SUBTOTAL";

export type RestaurantBillingSettings = {
  /** Legacy single rate — still honored when advanced GST is disabled. */
  taxRatePercent?: number;
  taxLabel?: string;
  currency?: string;
  priceMode?: TaxPriceMode;
  gstEnabled?: boolean;
  gstRatePercent?: number;
  supplyType?: GstSupplyType;
  packagingEnabled?: boolean;
  packagingMethod?: PackagingChargeMethod;
  packagingAmount?: number;
  packagingPercent?: number;
  serviceChargeEnabled?: boolean;
  serviceChargeType?: "FIXED" | "PERCENT";
  serviceChargeAmount?: number;
  serviceChargePercent?: number;
  effectiveFrom?: string;
  updatedAt?: string;
  updatedByEmail?: string;
};

export type BillBreakdown = {
  itemsSubtotal: number;
  billDiscount: number;
  packagingCharge: number;
  serviceCharge: number;
  taxableAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxLabel: string;
  gstRatePercent: number;
  supplyType?: GstSupplyType;
  priceMode: TaxPriceMode;
  total: number;
};

// Restaurant Profile
export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  coverImage?: string;
  description?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  openingHours?: string;
  currency?: string;
  socialLinks?: RestaurantSocialLinks;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Compatibility fields for customer menu UI
  logoUrl?: string;
  coverUrl?: string;
  isActive?: boolean;
  // Subscription fields
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEnabled?: boolean;
  featureOverrides?: Partial<Record<FeatureKey, boolean>>;
  // Theme/Branding fields
  theme?: RestaurantTheme;
  // Private server-side configuration; public serializers must omit it.
  wifi?: RestaurantWifiConfiguration;
  billing?: RestaurantBillingSettings;
  /** When set, this restaurant is an outlet of an organization. */
  organizationId?: string;
  inventorySettings?: RestaurantInventorySettings;
  loyaltySettings?: RestaurantLoyaltySettings;
};

export type InventoryConsumptionPoint = "ACCEPTED" | "PREPARING" | "READY" | "SERVED";

export type RestaurantInventorySettings = {
  /** Order status at which recipe stock is consumed (default PREPARING). */
  consumptionPoint?: InventoryConsumptionPoint;
  /** Auto-restore stock only when cancelling before this status and no item has started prep. */
  allowRestoreBefore?: InventoryConsumptionPoint;
  lowStockAlertEnabled?: boolean;
  /** When true, consumption fails if on-hand would go below zero (atomic conditional update). */
  enforceStock?: boolean;
};

export type RestaurantLoyaltySettings = {
  pointsPerCurrencyUnit?: number;
  currencyPerPoint?: number;
  enabled?: boolean;
};

// Category
export type Category = {
  id: string;
  restaurantId?: string;
  name: string;
  slug?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  /** Default kitchen station for dishes in this category (KDS routing). */
  kitchenStation?: KitchenStation;
  /** Category-level GST override (%). Dish override wins when set. */
  taxRatePercent?: number;
  createdAt?: string;
  updatedAt?: string;
};

// Dish Classification
export type DishType = "VEG" | "NON_VEG";

// Add-on
export type Addon = {
  id: string;
  addonGroupId?: string;
  name: string;
  price: number;
  isActive?: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

// Add-on Group
export type AddonGroup = {
  id: string;
  restaurantId?: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
  isActive?: boolean;
  addons: Addon[];
  createdAt?: string;
  updatedAt?: string;
};

// Dish
export type DishMediaItem = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  posterUrl?: string;
};

/** First-class size/portion options. QR may still use Size add-on groups; POS prefers variants. */
export type DishVariant = {
  id: string;
  name: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
  sku?: string;
};

export type Dish = {
  id: string;
  restaurantId?: string;
  categoryId: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  preparationTime?: number;
  type?: DishType;
  isVeg: boolean;
  isAvailable: boolean;
  isCustomizable?: boolean;
  image?: string;
  video?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  /** Extra photos and videos shown after the main image/video in the dish gallery. */
  gallery?: DishMediaItem[];
  sortOrder: number;
  addonGroupIds?: string[];
  addonGroups?: AddonGroup[];
  variants?: DishVariant[];
  /** Optional stable product code from POS/Excel imports. */
  sku?: string;
  /** Future multi-outlet: base menu item may override price per outlet later. */
  kitchenStation?: KitchenStation;
  /** Dish-level GST override (%). Wins over category and outlet defaults. */
  taxRatePercent?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

// Media
export type MediaType = "IMAGE" | "VIDEO";
export type MediaResourceType = "image" | "video" | "raw";

export type Media = {
  id: string;
  restaurantId: string;
  type: MediaType;
  url: string;
  publicId: string;
  resourceType: MediaResourceType;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  isExternal?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// Aggregated Menu
export type RestaurantMenu = {
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
};

export type RestaurantTable = {
  id: string;
  restaurantId: string;
  tableNumber: number;
  label?: string;
  capacity?: number;
  reservationRevision?: number;
  isActive: boolean;
  status: TableStatus;
  createdAt: string;
  updatedAt: string;
};

/** Floor lifecycle. OPEN = available for seating (legacy name kept for compatibility). */
export type TableStatus =
  | "OPEN"
  | "OCCUPIED"
  | "BILL_REQUESTED"
  | "PAYMENT_PENDING"
  | "CLEANING"
  | "CLOSED";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type Reservation = {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumberSnapshot: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  startAt: Date;
  endAt: Date;
  timezone: "Asia/Kolkata";
  guestCount: number;
  specialRequest?: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "REFUNDED";

export type OrderChannel = "QR" | "POS_DINE_IN" | "POS_TAKEAWAY" | "POS_DELIVERY";

export type OrderAddonSnapshot = {
  addonId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  total: number;
};

export type OrderItemSnapshot = {
  lineId?: string;
  dishId: string;
  dishNameSnapshot: string;
  variantId?: string;
  variantNameSnapshot?: string;
  quantity: number;
  unitPriceSnapshot: number;
  addons: OrderAddonSnapshot[];
  itemDiscountAmount?: number;
  note?: string;
  kitchenStation?: KitchenStation;
  preparationStatus?: "QUEUED" | "PREPARING" | "READY";
  /** Cumulative quantity cancelled on this line (partial cancel). */
  cancelledQuantity?: number;
  itemTotal: number;
};

// Payment Recording Types
export type PaymentMethod = "CASH" | "UPI" | "CARD";
export type PaymentStatus = "NOT_RECORDED" | "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
export type PaymentAuditAction = "RECORD" | "PARTIAL" | "CORRECTION" | "REVERSAL" | "REFUND";

export type PaymentAuditActor = {
  role: "RESTAURANT_ADMIN" | "CAPTAIN";
  id: string;
  email?: string;
  name?: string;
};

export type PaymentAuditEvent = {
  eventId: string;
  action: PaymentAuditAction;
  previousStatus: PaymentStatus;
  newStatus: PaymentStatus;
  previousMethod?: PaymentMethod;
  newMethod?: PaymentMethod;
  amount: number;
  actor: PaymentAuditActor;
  reason?: string;
  timestamp: string;
};

export type PaymentLedgerEntry = {
  id: string;
  kind: "CHARGE" | "REFUND";
  method: PaymentMethod;
  amount: number;
  recordedAt: string;
  recordedBy: PaymentAuditActor;
  reason?: string;
};

export type PaymentSummary = {
  status: PaymentStatus;
  method?: PaymentMethod;
  amount?: number;
  amountPaid?: number;
  recordedAt?: string;
  recordedBy?: PaymentAuditActor;
  auditTrail?: PaymentAuditEvent[];
  ledger?: PaymentLedgerEntry[];
};

export type CustomerPaymentSummary = {
  status: PaymentStatus;
  method?: PaymentMethod;
  recordedAt?: string;
};

export type OrderEventType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "PAYMENT"
  | "NOTE"
  | "ITEM_PREP"
  | "RECEIPT_REPRINT"
  | "REFUND"
  | "LINE_CANCELLED"
  | "CAPTAIN_AUTHORIZATION";

/** Captain gate — separate from kitchen OrderStatus. QR must stay pending until approved. */
export type CaptainAuthorizationStatus =
  | "PENDING_CAPTAIN_APPROVAL"
  | "CAPTAIN_APPROVED"
  | "REJECTED"
  | "CORRECTION_REQUESTED"
  | "NOT_REQUIRED";

export type OrderEntrySource = "CAPTAIN_DIRECT" | "CUSTOMER_QR" | "POS";

export type CaptainAuthorization = {
  status: CaptainAuthorizationStatus;
  entrySource: OrderEntrySource;
  authorizedCaptainId?: string;
  authorizedCaptainName?: string;
  authorizedAt?: string;
  decisionReason?: string;
  decisionIdempotencyKey?: string;
};

export type OrderEvent = {
  id: string;
  type: OrderEventType;
  at: string;
  actor?: PaymentAuditActor;
  message: string;
  meta?: Record<string, unknown>;
};

export type RestaurantOrder = {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  orderNumber: number;
  customerTokenHash: string;
  idempotencyKey: string;
  status: OrderStatus;
  channel?: OrderChannel;
  source?: "QR" | "POS" | "CAPTAIN";
  guestCount?: number;
  orderNote?: string;
  /** Captain authorization gate (QR pending until approved). */
  captainAuthorization?: CaptainAuthorization;
  items: OrderItemSnapshot[];
  subtotal: number;
  /** Bill-level discount absolute amount (snapshotted). */
  billDiscountAmount?: number;
  couponCodeSnapshot?: string;
  couponDiscountAmount?: number;
  loyaltyPointsRedeemed?: number;
  customerId?: string;
  taxRatePercent?: number;
  taxAmount?: number;
  packagingCharge?: number;
  serviceCharge?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  /** Immutable financial breakdown captured at create/append time. */
  billSnapshot?: BillBreakdown;
  total: number;
  payment: PaymentSummary;
  events?: OrderEvent[];
  shiftId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type OrderSummary = Pick<
  RestaurantOrder,
  | "id"
  | "orderNumber"
  | "tableNumber"
  | "tableId"
  | "status"
  | "channel"
  | "source"
  | "guestCount"
  | "captainAuthorization"
  | "items"
  | "subtotal"
  | "billDiscountAmount"
  | "taxRatePercent"
  | "taxAmount"
  | "packagingCharge"
  | "serviceCharge"
  | "cgstAmount"
  | "sgstAmount"
  | "igstAmount"
  | "billSnapshot"
  | "total"
  | "payment"
  | "orderNote"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
>;

export type PosShift = {
  id: string;
  restaurantId: string;
  openedBy: PaymentAuditActor;
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  closedBy?: PaymentAuditActor;
  closingCashCounted?: number;
  expectedCash?: number;
  notes?: string;
  status: "OPEN" | "CLOSED";
};

// --- Phase 4: Organization / multi-outlet ---
export type Organization = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryUnit = "g" | "kg" | "ml" | "l" | "pcs" | "dozen";

export type Ingredient = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  name: string;
  sku?: string;
  /** Canonical stock unit for ledger quantities. */
  baseUnit: InventoryUnit;
  /** Convert other units into baseUnit: multiplier * qty = base qty. */
  conversions: Partial<Record<InventoryUnit, number>>;
  /** Current on-hand in baseUnit (denormalized from ledger for speed). */
  quantityOnHand: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  averageUnitCost?: number;
  lastPurchaseUnitCost?: number;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeLine = {
  ingredientId: string;
  quantity: number;
  unit: InventoryUnit;
};

export type Recipe = {
  id: string;
  restaurantId: string;
  dishId: string;
  name: string;
  yieldPortions: number;
  lines: RecipeLine[];
  estimatedCostPerPortion?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovementKind =
  | "PURCHASE_RECEIPT"
  | "SALE_CONSUMPTION"
  | "ADJUSTMENT"
  | "WASTAGE"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "RECONCILIATION"
  | "RESTORE_CANCEL";

export type InventoryMovement = {
  id: string;
  restaurantId: string;
  ingredientId: string;
  kind: InventoryMovementKind;
  /** Signed delta in ingredient baseUnit. */
  quantityDelta: number;
  unitCost?: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  /** Dedup key e.g. consume:orderId or restore:orderId */
  idempotencyKey: string;
  note?: string;
  actor?: PaymentAuditActor;
  createdAt: string;
};

export type InventoryConsumptionLine = {
  ingredientId: string;
  quantityBase: number;
  movementId: string;
  /** Order item lineId when consumption is attributable to a specific line. */
  orderLineId?: string;
  restoredQuantityBase?: number;
};

export type InventoryConsumptionRecord = {
  id: string;
  restaurantId: string;
  orderId: string;
  idempotencyKey: string;
  status: "CONSUMED" | "RESTORED" | "PARTIALLY_RESTORED" | "BLOCKED_NO_RESTORE";
  lines: InventoryConsumptionLine[];
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export type MenuSyncStatus = "DRAFT" | "PREVIEW" | "PUBLISHED" | "ROLLED_BACK";

export type MenuSyncDishSnapshot = {
  restaurantId: string;
  dishId: string;
  payload: Record<string, unknown>;
  capturedAt: string;
};

export type MenuSyncJob = {
  id: string;
  organizationId: string;
  sourceRestaurantId: string;
  targetRestaurantIds: string[];
  status: MenuSyncStatus;
  /** Fields that branch outlets may keep locally and must not be overwritten. */
  preserveBranchFields: Array<"price" | "isAvailable" | "sortOrder" | "kitchenStation">;
  snapshotSummary?: string;
  /** Pre-publish snapshots of target dishes for rollback. */
  prePublishSnapshots?: MenuSyncDishSnapshot[];
  /** Content hashes at publish time to detect post-publish edits. */
  publishFingerprints?: { restaurantId: string; dishId: string; hash: string }[];
  rollbackPreview?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  rolledBackAt?: string;
  createdBy: PaymentAuditActor;
};

export type Supplier = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  /** Expected days from PO send to receipt. Default 2 when unset. */
  leadTimeDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FiguresSource = "ACTUAL" | "ESTIMATED" | "INSUFFICIENT_DATA";

export type AiForecastHorizon = "TOMORROW" | "NEXT_7_DAYS" | "NEXT_30_DAYS";

export type AiForecastPoint = {
  date: string;
  revenueP10: number;
  revenueP50: number;
  revenueP90: number;
  orderVolumeP10: number;
  orderVolumeP50: number;
  orderVolumeP90: number;
};

export type AiForecastRun = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  horizon: AiForecastHorizon;
  modelVersion: string;
  inputFrom: string;
  inputTo: string;
  generatedAt: string;
  figuresSource: FiguresSource;
  points: AiForecastPoint[];
  note?: string;
};

export type AiAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AiAlertStatus = "NEW" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export type AiAlert = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  type: string;
  dedupeKey: string;
  title: string;
  severity: AiAlertSeverity;
  status: AiAlertStatus;
  detectionFrom: string;
  detectionTo: string;
  supportingData: Record<string, unknown>;
  reason: string;
  suggestedAction: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
};

export type AiUsageEvent = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  accountId: string;
  route: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  createdAt: string;
};

export type MenuDishClass = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG" | "UNCLASSIFIED";

export type PurchaseOrderLine = {
  ingredientId: string;
  nameSnapshot: string;
  quantity: number;
  unit: InventoryUnit;
  unitCost: number;
  receivedQuantity: number;
};

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export type PurchaseOrder = {
  id: string;
  restaurantId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderNumber: number;
  lines: PurchaseOrderLine[];
  expectedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
};

export type GoodsReceipt = {
  id: string;
  restaurantId: string;
  purchaseOrderId: string;
  supplierId: string;
  lines: {
    ingredientId: string;
    quantity: number;
    unit: InventoryUnit;
    unitCost: number;
  }[];
  receivedAt: string;
  receivedBy: PaymentAuditActor;
  invoiceNumber?: string;
  notes?: string;
};

export type CustomerProfile = {
  id: string;
  restaurantId: string;
  organizationId?: string;
  phone: string;
  email?: string;
  name?: string;
  segment?: "NEW" | "REGULAR" | "VIP" | "LAPSED";
  loyaltyPoints: number;
  totalOrders: number;
  totalSpend: number;
  marketingOptIn: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean;
  lastOrderAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type LoyaltyTransactionKind = "EARN" | "REDEEM" | "ADJUST" | "EXPIRE";

export type LoyaltyTransaction = {
  id: string;
  restaurantId: string;
  customerId: string;
  kind: LoyaltyTransactionKind;
  points: number;
  balanceAfter: number;
  orderId?: string;
  couponId?: string;
  idempotencyKey: string;
  note?: string;
  createdAt: string;
};

export type Coupon = {
  id: string;
  restaurantId: string;
  code: string;
  description?: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minOrderTotal?: number;
  maxRedemptions?: number;
  redemptionCount: number;
  pointsCost?: number;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Ledger of coupon uses — unique idempotencyKey prevents duplicate redemptions. */
export type CouponRedemption = {
  id: string;
  restaurantId: string;
  couponId: string;
  codeSnapshot: string;
  orderId?: string;
  customerId?: string;
  discountAmount: number;
  idempotencyKey: string;
  status: "RESERVED" | "CONFIRMED" | "RELEASED";
  createdAt: string;
  updatedAt: string;
};

export type AccessAssignmentAudit = {
  id: string;
  restaurantAdminAccountId: string;
  organizationId?: string;
  previous: {
    organizationId?: string;
    orgRole?: OrgRole;
    outletIds?: string[];
    isActive?: boolean;
  };
  next: {
    organizationId?: string;
    orgRole?: OrgRole;
    outletIds?: string[];
    isActive?: boolean;
  };
  changedBy: { role: "SUPER_ADMIN"; email: string };
  reason?: string;
  createdAt: string;
};

export type OrderLineCancellation = {
  id: string;
  restaurantId: string;
  orderId: string;
  orderLineId: string;
  quantityCancelled: number;
  reason: string;
  inventoryRestoreStatus: "RESTORED" | "BLOCKED" | "NONE";
  idempotencyKey: string;
  actor: PaymentAuditActor;
  createdAt: string;
};

export type CustomerFeedback = {
  id: string;
  restaurantId: string;
  customerId?: string;
  orderId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

export type StockTransfer = {
  id: string;
  organizationId: string;
  fromRestaurantId: string;
  toRestaurantId: string;
  status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";
  lines: { ingredientId: string; quantity: number; unit: InventoryUnit }[];
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
};

// Standard API Response envelope
export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: unknown };
