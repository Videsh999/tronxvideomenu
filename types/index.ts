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
  createdAt: string;
  updatedAt: string;
};

export type CaptainView = Omit<Captain, "passwordHash" | "passwordCiphertext" | "passwordIv" | "passwordAuthTag"> & {
  passwordConfigured: boolean;
};

export type RestaurantAdminAccount = {
  id: string;
  restaurantId: string;
  email: string;
  passwordHash: string;
  passwordCiphertext?: string;
  passwordIv?: string;
  passwordAuthTag?: string;
  isActive: boolean;
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
  | "ANALYTICS";

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

export type TableStatus = "OPEN" | "OCCUPIED" | "CLOSED";

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
  | "CANCELLED";

export type OrderAddonSnapshot = {
  addonId: string;
  nameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  total: number;
};

export type OrderItemSnapshot = {
  dishId: string;
  dishNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  addons: OrderAddonSnapshot[];
  itemTotal: number;
};

// Payment Recording Types
export type PaymentMethod = "CASH" | "UPI" | "CARD";
export type PaymentStatus = "NOT_RECORDED" | "UNPAID" | "PAID";
export type PaymentAuditAction = "RECORD" | "CORRECTION" | "REVERSAL";

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

export type PaymentSummary = {
  status: PaymentStatus;
  method?: PaymentMethod;
  amount?: number;
  recordedAt?: string;
  recordedBy?: PaymentAuditActor;
  auditTrail?: PaymentAuditEvent[];
};

export type CustomerPaymentSummary = {
  status: PaymentStatus;
  method?: PaymentMethod;
  recordedAt?: string;
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
  items: OrderItemSnapshot[];
  subtotal: number;
  total: number;
  payment: PaymentSummary;
  createdAt: string;
  updatedAt: string;
};

export type OrderSummary = Pick<
  RestaurantOrder,
  | "id"
  | "orderNumber"
  | "tableNumber"
  | "status"
  | "items"
  | "subtotal"
  | "total"
  | "payment"
  | "createdAt"
  | "updatedAt"
>;

// Standard API Response envelope
export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: unknown };
