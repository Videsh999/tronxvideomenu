export type ImportStrategy = "CREATE_ONLY" | "UPDATE_MATCHING" | "SMART_MERGE";

export type ImportJobStatus =
  | "UPLOADED"
  | "ANALYZING"
  | "AWAITING_MAPPING"
  | "VALIDATING"
  | "READY_TO_IMPORT"
  /** @deprecated Prefer READY_TO_IMPORT — kept for existing jobs/UI */
  | "AWAITING_REVIEW"
  | "IMPORTING"
  /** @deprecated Prefer IMPORTING */
  | "COMMITTING"
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type CanonicalColumn =
  | "itemName"
  | "category"
  | "description"
  | "price"
  | "compareAtPrice"
  | "dietary"
  | "prepTime"
  | "sku"
  | "tags"
  | "availability"
  | "addonGroup"
  | "addonName"
  | "addonPrice"
  | "ignore";

export type ColumnMapping = {
  sourceHeader: string;
  columnIndex: number;
  canonical: CanonicalColumn;
  confidence: number;
  variantName?: string; // when header maps to a size/variant price column
};

export type DetectedSheet = {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
};

export type ParsedWorkbook = {
  sheets: DetectedSheet[];
  /** Raw grid per sheet (including header row). Values are display strings only — formulas never executed. */
  grids: Record<string, string[][]>;
};

export type ImportVariant = {
  name: string;
  price: number;
  confidence: number;
};

export type ImportAddonDraft = {
  groupName: string;
  name: string;
  price: number;
  isRequired?: boolean;
};

export type ImportItemAction = "CREATE" | "UPDATE" | "SKIP" | "NEEDS_REVIEW";

export type ImportItemDraft = {
  rowKey: string;
  sourceRowNumbers: number[];
  name: string;
  categoryName: string;
  description?: string;
  price: number | null;
  compareAtPrice?: number | null;
  dietary?: "VEG" | "NON_VEG" | "UNKNOWN";
  prepTimeMinutes?: number | null;
  sku?: string;
  tags?: string[];
  isAvailable: boolean;
  variants: ImportVariant[];
  addons: ImportAddonDraft[];
  confidence: number;
  action: ImportItemAction;
  matchDishId?: string;
  matchReason?: string;
  errors: string[];
  warnings: string[];
  included: boolean;
};

export type ImportPreview = {
  strategy: ImportStrategy;
  categoriesToCreate: string[];
  categoriesExisting: string[];
  items: ImportItemDraft[];
  summary: {
    totalRows: number;
    validItems: number;
    invalidItems: number;
    createCount: number;
    updateCount: number;
    skipCount: number;
    needsReviewCount: number;
    averageConfidence: number;
    warningCount?: number;
  };
};

export type ImportCommitResult = {
  createdCategories: number;
  createdDishes: number;
  updatedDishes: number;
  createdAddonGroups: number;
  createdAddons: number;
  skipped: number;
  /** Total preview rows considered for this commit. */
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  failedRows?: number;
  warningCount?: number;
  errors: string[];
  rollbackToken?: string;
};

export type MenuImportJob = {
  id: string;
  restaurantId: string;
  uploadedByEmail: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: ImportJobStatus;
  selectedSheet?: string;
  sheets: DetectedSheet[];
  /** Stored grids keyed by sheet name (truncated for safety). */
  grids: Record<string, string[][]>;
  columnMappings: ColumnMapping[];
  strategy: ImportStrategy;
  preview?: ImportPreview;
  result?: ImportCommitResult;
  /** Snapshot of dish ids created/updated for compensating rollback. */
  rollback?: {
    createdCategoryIds: string[];
    createdDishIds: string[];
    updatedDishes: Array<{ id: string; before: Record<string, unknown> }>;
    createdAddonGroupIds: string[];
    createdAddonIds: string[];
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};
