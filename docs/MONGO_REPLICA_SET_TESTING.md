# MongoDB replica-set integration testing

Phase 4.1 closure concurrency tests require a **replica set** (or Atlas cluster). Standalone `mongod` cannot run multi-document transactions.

## Local Docker (recommended)

```bash
docker run -d --name tronx-mongo-rs -p 27017:27017 mongo:7 \
  --replSet rs0 --bind_ip_all

docker exec tronx-mongo-rs mongosh --eval \
  'rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:27017"}]})'
```

Wait until `rs.status().ok === 1`, then:

```bash
export RUN_INTEGRATION=1
export MONGODB_URI='mongodb://127.0.0.1:27017/tronx_integration?replicaSet=rs0'
npm run test:integration
```

## Atlas / staging

1. Use any Atlas M0+ replica set URI (already a replica set).
2. Point `MONGODB_URI` at a dedicated `tronx_integration` database.
3. Run the same `npm run test:integration` command from CI or a staging bastion.

## What the suite verifies

| Scenario | Assertion |
|----------|-----------|
| 20 concurrent coupon reserves, `maxRedemptions=1` | Exactly one `ok:true`; `redemptionCount=1` |
| 10 concurrent loyalty redeems of 10 pts | Exactly one success; balance 0 |
| Duplicate purchase receipt key | Stock increased once |
| 8 concurrent consume of last unit | Exactly one success; on-hand 0 |

Additional staging checklist (manual / scripted against staging URI):

1. Two POS orders competing for the last recipe ingredient with `enforceStock=true`.
2. Simultaneous stock transfer send for the same DRAFT transfer id — one SENT, movements not duplicated.
3. Repeated order status webhook / status PATCH with the same transition — second call 409 / no-op.
4. Kill mongod mid-receive, restart, re-run same receipt idempotency key — ledger matches PO received qty.
5. Partial cancel after consume — only QUEUED lines restore; PREP/READY blocked.

## Without replica set

Unit tests (`npm test`) always run. Integration tests **skip** (they do not mock concurrency). Do not treat skipped integration as verified concurrency.
