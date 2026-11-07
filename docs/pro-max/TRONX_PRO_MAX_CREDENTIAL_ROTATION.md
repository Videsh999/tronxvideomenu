# Credential rotation after the demo password left git

Wave 1 removes the demo restaurant-admin password from source. The value is not repeated here.

## What was committed

Before this wave, `lib/demo/seed-demo-kitchen.ts` exported `DEMO_KITCHEN.adminPassword` as a string literal, and `scripts/verify-demo-reupload-import.mjs` sent the same literal to login. The guides `DEMO_RESTAURANT_GUIDE.md` and `MEDIA_AND_IMPORT_GUIDE.md` printed it. Any database that ran that seed stored a hash of that password for:

- restaurant id `tronx-demo-kitchen`
- slug `tronx-demo-kitchen`
- admin email `demo@tronx.local`

If that seed also stored recoverable ciphertext (`passwordCiphertext`, `passwordIv`, `passwordAuthTag`) and `CREDENTIALS_ENCRYPTION_KEY` is known, the old password can still be decrypted. Rotating the encryption key does not rewrite existing ciphertext.

## What to do

1. On every database where that seed ran, set a new restaurant-admin password through the super-admin password route or the admin credential update. Do not log the old or new password.
2. Confirm the previous password no longer signs in.
3. New seeds read `TRONX_DEMO_ADMIN_PASSWORD` from the environment (minimum 12 characters). They also require `TRONX_DEMO_SEED_CONFIRM=localhost`, a loopback `MONGODB_URI`, and a non-production `NODE_ENV`. The seed does not print the password and the HTTP response does not include it.
4. `POST /api/dev/seed-demo-kitchen` is not a public route. The proxy refuses it in production and on any host that is not loopback. `ALLOW_PRODUCTION_SEED` is no longer honored.

Captains and restaurant admins created with the old demo password should be reset the same way. This wave does not scan or rewrite live databases.
