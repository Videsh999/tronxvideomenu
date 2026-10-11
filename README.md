# TRONX Restaurant

TRONX is a digital restaurant menu with a public customer menu and an authenticated admin console for managing restaurants, categories, dishes, add-ons, availability, and media.

## Stack

- Next.js 16 App Router and React 19
- TypeScript and Tailwind CSS
- MongoDB with Mongoose
- Cloudinary for image and video assets
- Zod and React Hook Form for validation and admin forms

## Local Setup

```bash
npm install
```

Copy `.env.example` to `.env.local`, provide local values, ensure MongoDB and Cloudinary are available, then seed the default restaurant data:

```bash
npm run seed:mongodb
```

The seed is idempotent and inserts missing demo records without overwriting existing records.

## Environment Variables

Required server-side variables:

```dotenv
MONGODB_URI=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
AUTH_SECRET=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
CREDENTIALS_ENCRYPTION_KEY=
```

Never expose these values through `NEXT_PUBLIC_*` variables or client components. `.env.local` is ignored by Git.

## Running Locally

```bash
npm run dev
```

Public menu:

- `http://localhost:3000/`
- `http://localhost:3000/menu/moai-kitchen`
- `http://localhost:3000/menu/native-south`

Admin:

- `http://localhost:3000/admin/login`
- `http://localhost:3000/super-admin/login`
- `http://localhost:3000/admin/moai-kitchen`

Super admin credentials come from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. New Restaurant Admin credentials are managed per restaurant in MongoDB from Super Admin. Existing `MOAI_KITCHEN_ADMIN_*` and `NATIVE_SOUTH_ADMIN_*` environment credentials remain supported as a legacy login source and can be migrated explicitly from the Super Admin credential panel. `AUTH_SECRET` signs the httpOnly admin session cookies.

Keep the legacy Restaurant Admin variables in local and Vercel configuration until each affected restaurant shows a database account in Super Admin and the explicit **Verify database login and recovery** check succeeds. Then test that Restaurant Admin's normal login page and session work in that environment. Only after those checks pass for both legacy restaurants may you remove their `*_ADMIN_EMAIL`, `*_ADMIN_PASSWORD`, and `*_ADMIN_RESTAURANT_SLUG` variables from that environment. Do not infer production readiness from a local database check.

`CREDENTIALS_ENCRYPTION_KEY` is a server-only Base64 value containing exactly 32 random bytes. Generate it with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set the same persistent value in local and production server environments. Do not expose it with a `NEXT_PUBLIC_` prefix or commit it. Replacing this key without a planned re-encryption migration makes already encrypted Restaurant Admin and Captain passwords unreadable. This credential key is separate from the existing `WIFI_ENCRYPTION_KEY`; do not replace or rotate the Wi-Fi key as part of this feature. Existing Captain accounts that have only a password hash remain valid for login, but their original password cannot be recovered; a Restaurant Admin can explicitly set a new recoverable password for that Captain.

### Local credential migration and verification

Use a dedicated **non-production** MongoDB database for local credential testing. Do not point local setup or the seed command at production. The credential flow needs `MONGODB_URI`, `AUTH_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and `CREDENTIALS_ENCRYPTION_KEY`. Keep the existing restaurant-specific `*_ADMIN_RESTAURANT_SLUG`, `*_ADMIN_EMAIL`, and `*_ADMIN_PASSWORD` values configured while those accounts still depend on legacy login. `WIFI_ENCRYPTION_KEY` is separate and must not be rotated for credential migration. Cloudinary variables are needed for media operations, not for credential login itself.

1. Copy `.env.example` to `.env.local` if needed and fill in the required values using only local/test services. Generate a credential key once with the command above, put its output after `CREDENTIALS_ENCRYPTION_KEY=` in `.env.local`, and keep that same key securely backed up. The key must be canonical Base64 for exactly 32 random bytes. Do not generate a replacement on each start.
2. Stop and restart `npm run dev` after adding or changing the key. Next.js loads `.env.local` when the server starts. In Super Admin, the credential panel should report encryption configuration as ready. A missing/invalid status means credential encryption and recovery checks are not ready.
3. Sign in at `http://localhost:3000/super-admin/login`. Open the restaurant list and inspect each restaurant's Restaurant Admin account panel. For a legacy-only account, choose **Migrate to encrypted storage**. Migration is insert-if-absent; it does not overwrite an existing database account.
4. For each migrated restaurant, choose **Verify database login and recovery**. Continue only when it reports that the stored encrypted password decrypts and authenticates through the tenant-scoped database login. This check is environment-specific and does not verify production when run locally.
5. Open the panel's Admin login URL and sign in through the ordinary Restaurant Admin login page. Confirm the correct restaurant dashboard opens and that another tenant cannot be reached with that account. This normal login test is required in addition to the migration verification action.
6. In that restaurant's Admin → Captains page, create a test Captain with a temporary password, then use the generated Captain login URL (`/captain/login?restaurant=<slug>`) to sign in. Confirm the Admin page can show/copy the saved password. For a pre-existing hash-only Captain, the UI says the original password is not recoverable; **Set retrievable password** explicitly replaces it with a new password. Test login and retrieval with that new password. Do not change real Captain passwords during testing.
7. Deactivate a disposable test Captain and confirm its existing Captain session no longer grants access. Reactivate it afterward if needed. Deactivating a Restaurant Admin similarly invalidates database-backed sessions; reactivating does not restore an expired browser session automatically.
8. Remove a restaurant's legacy variables only from an environment after that same environment shows the database account, passes **Verify database login and recovery**, and passes ordinary Restaurant Admin login. Remove only that restaurant's matching slug/email/password variables. Repeat the checks separately in every environment before removing its variables there. Keep all legacy variables until both local/non-production accounts have been proven; never infer production readiness from local checks.

Keep `AUTH_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, and the persistent `CREDENTIALS_ENCRYPTION_KEY` configured in every application environment. Keep `WIFI_ENCRYPTION_KEY` wherever the existing Wi-Fi feature needs it. Keep `MONGODB_URI` and the Cloudinary credentials required by the deployed application. Do not put any of these values in client-visible variables or commit them.

## Production Build

```bash
npm run build
npm run start
```

Configure MongoDB network access, Cloudinary credentials, HTTPS, and deployment secrets in the hosting platform rather than committing them.

## Architecture

Admin and customer data flows through the existing repository/service layers into MongoDB. Customer menus use the public restaurant menu API, while media uploads and deletion use server-side Cloudinary operations followed by MongoDB persistence.
