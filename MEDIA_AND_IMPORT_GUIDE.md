# Media library & Excel re-upload guide

## How media works (why uploads don’t show on the menu)

The **Media Library** is an asset bank — not the menu itself.

| Step | What happens |
| --- | --- |
| 1. Upload in **Media** | File is stored (Cloudinary when configured). It is **not** linked to any dish yet. |
| 2. Assign to a dish | Media → **Assign to dish**, or **Dishes → Edit → Choose from library** |
| 3. Save dish | `imageUrl` / `videoUrl` is stored on the dish record |
| 4. Customer menu / POS | Cards read the dish’s `imageUrl` / `videoUrl` |

**Excel import never attaches photos.** Spreadsheets carry names, prices, SKUs, etc. Photos are always assigned in Media or Dishes.

POS does **not** have a separate media pipeline — it shows the same dish image as the customer menu when `imageUrl` is set.

---

## Excel re-upload (no duplicates)

Default strategy is **Update matching · create new**.

When you upload a second workbook:

1. We scan each row against the live menu by **SKU** (preferred) and **name + category**.
2. Matches → **UPDATE once** (price/description change). Not created again.
3. New rows → **CREATE**.
4. Duplicate rows **inside the same file** → first kept, rest **SKIP**.

Also available:

- **Smart merge** — matches need you to tick “include” before update  
- **Create new only** — matches are skipped entirely  

Fixtures for testing:

- `fixtures/tronx-demo-kitchen-menu.xlsx` — full 80-item demo menu  
- `fixtures/tronx-demo-kitchen-reupload.xlsx` — overlaps + new specials + in-file duplicate  

```bash
npm run demo:workbook
npm run demo:workbook:reupload
npm run demo:seed:http          # while next dev is running
npm run demo:verify:reupload    # live login → import reupload xlsx → assert no SKU dups
```

Demo login email: `demo@tronx.local`. The password comes from `TRONX_DEMO_ADMIN_PASSWORD` and is not stored in source.

### Media → menu (POS same)

```
Media Library (upload) ──► assign to dish (imageUrl / videoUrl) ──► customer menu + POS cards
```

Uploading alone never places a photo on a dish. Excel never attaches photos. Assign in Media or Dishes → Choose from library.
