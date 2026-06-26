# Demo analytics migration transfer

This folder contains a migration dump only for the demo analytics report accounts created by `seed-demo-trends`.

## Files

- `generate-demo-analytics-dump.mjs`: Generates the migration dump and account list.
- `demo-analytics-migration.sql`: Data-only SQL dump for demo analytics tables (generated file).
- `demo-analytics-accounts.json`: Demo account IDs and login IDs (generated file).

## Generate dump

Run from repo root:

```bash
node transfer/generate-demo-analytics-dump.mjs
```

## Import dump

Use your target database URL:

```bash
psql "$DATABASE_URL" -f transfer/demo-analytics-migration.sql
```

## Demo login credentials (all IDs + password)

- Password for all demo accounts: `welcome`

| Role | Name | Login ID (email) | User ID |
|---|---|---|---|
| student | Aarav Sharma | `demo.aarav@els.ai` | `2f81b9f3-93eb-4469-af09-b90fd20773dd` |
| student | Ananya Reddy | `demo.ananya@els.ai` | `d6f4b378-e7d9-41ad-992d-0c1bc4bf89b9` |
| student | Diya Patel | `demo.diya@els.ai` | `69e83c05-0387-4621-abe4-13371fefcd50` |
| student | Kabir Khan | `demo.kabir@els.ai` | `139d1000-d432-4038-a197-7fa474ba1f56` |
| student | Vivaan Gupta | `demo.vivaan@els.ai` | `64e37f97-c96e-434b-ae56-03ac558c1f8a` |
| parent | Sunita Sharma | `demo.parent.sharma@els.ai` | `e150da14-eefa-4e8d-ac53-25ff457e5ae6` |
| parent | Rakesh Patel | `demo.parent.patel@els.ai` | `b3e7d2ae-2a6e-4e00-ab9b-b1c4c6b790ec` |
| parent | Imran Khan | `demo.parent.khan@els.ai` | `9ae11a8d-9201-497a-b574-3fe1312f175e` |
| parent | Lakshmi Reddy | `demo.parent.reddy@els.ai` | `3e4e0463-1589-40a7-879d-6e3cd805e882` |
| parent | Manoj Gupta | `demo.parent.gupta@els.ai` | `bea91a28-8d07-4490-a3d6-e9b3bd0a59d6` |
| parent | Demo Parent | `demo.parent@els.ai` | `b4448038-cdcd-4d1b-892b-57e6a162e728` |
| teacher | Meera Iyer | `demo.teacher.iyer@els.ai` | `02135cdc-4812-4992-ae6b-e4e117d2ca6f` |
| teacher | Arjun Nair | `demo.teacher.nair@els.ai` | `e016cd08-0af7-4c1c-9042-2a1ff60e7db4` |
| teacher | Pooja Joshi | `demo.teacher.joshi@els.ai` | `86d281ef-80c0-4746-a027-a850d0bc0304` |
| teacher | Sanjay Verma | `demo.teacher.verma@els.ai` | `1cceb2a8-6068-4bcf-8412-5c353bac8992` |
| teacher | Neha Desai | `demo.teacher.desai@els.ai` | `7adba89c-9db5-4b09-9064-0d7acfaee174` |

If IDs change after reseeding, regenerate and use the refreshed `demo-analytics-accounts.json`.

## Scope guarantee

The generated dump includes only rows linked to these demo emails:

- `demo.aarav@els.ai`
- `demo.diya@els.ai`
- `demo.kabir@els.ai`
- `demo.ananya@els.ai`
- `demo.vivaan@els.ai`
- `demo.parent.sharma@els.ai`
- `demo.parent.patel@els.ai`
- `demo.parent.khan@els.ai`
- `demo.parent.reddy@els.ai`
- `demo.parent.gupta@els.ai`
- `demo.parent@els.ai`
- `demo.teacher.iyer@els.ai`
- `demo.teacher.nair@els.ai`
- `demo.teacher.joshi@els.ai`
- `demo.teacher.verma@els.ai`
- `demo.teacher.desai@els.ai`
