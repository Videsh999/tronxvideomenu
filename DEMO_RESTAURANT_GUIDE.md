# TRONX Demo Kitchen — Guide

Isolated local demo outlet. The seed refuses production and any non-loopback database. Set `TRONX_DEMO_SEED_CONFIRM=localhost` and `TRONX_DEMO_ADMIN_PASSWORD` (at least 12 characters) in the environment. The password is not stored in this repository.

## 1. Create Excel workbooks

```bash
npm run demo:workbook
npm run demo:workbook:reupload
```

| File | Purpose |
| --- | --- |
| `fixtures/tronx-demo-kitchen-menu.xlsx` | 80 dishes, 12 categories |
| `fixtures/tronx-demo-kitchen-reupload.xlsx` | Overlaps (should update) + new specials + in-file duplicate |

## 2. Seed restaurant

Preferred while `next dev` is running (uses the app’s Mongo connection):

```bash
npm run demo:seed:http
```

Or directly:

```bash
npm run demo:seed
```

| Field | Value |
| --- | --- |
| Name | TRONX Demo Kitchen |
| Slug | `tronx-demo-kitchen` |
| Admin | `demo@tronx.local` |
| Password | `TRONX_DEMO_ADMIN_PASSWORD` from the environment. Not printed by the seed. |
| Menu | `/menu/tronx-demo-kitchen` |
| Admin | `/admin/tronx-demo-kitchen` |

## 3. Workflow checklist

1. Sign in as demo admin  
2. **Import Excel** → first workbook → strategy **Update matching** → commit  
3. Open customer menu — names/prices visible  
4. **Import Excel** again with **reupload** workbook — matches update once; duplicate row skipped; new specials created  
5. **Media** → upload photo → Assign to a dish → confirm menu/POS shows image  
6. **POS** → open shift → select table (or Takeaway) → Place & pay  

Automated re-upload merge check (server must be up, demo already seeded):

```bash
npm run demo:verify:reupload
```

Expected: 3 UPDATE + 2 CREATE, then **≥82 dishes** and **zero SKU duplicates**.

See also `MEDIA_AND_IMPORT_GUIDE.md`.
