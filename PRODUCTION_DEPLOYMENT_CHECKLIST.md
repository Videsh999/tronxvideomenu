# Production Deployment Checklist

## Before deploy

- [ ] `npx tsc --noEmit` clean  
- [ ] `npm test` clean  
- [ ] `npm run test:integration` against replica-set capable env  
- [ ] `npm run build` succeeds  
- [ ] Env secrets present (`MONGODB_URI`, `AUTH_SECRET`, media keys)  
- [ ] Feature flags / plans reviewed per tenant  
- [ ] No `ALLOW_PRODUCTION_SEED` in production  

## Smoke after deploy

- [ ] Admin login / logout  
- [ ] Customer menu names + prices visible  
- [ ] Menu export downloads valid xlsx  
- [ ] Menu import of fixture (staging only)  
- [ ] POS: catalog + bill fully visible; place + pay cash order  
- [ ] Kitchen receives order  
- [ ] Reports gross sales matches paid ledger for the smoke order  
- [ ] Devices page does not claim PHYSICALLY_VERIFIED for simulators  

## Rollback

- [ ] Keep previous Vercel/deployment target ready  
- [ ] Do not run destructive DB migrations without backup  
