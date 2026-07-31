# Persistent Database Setup for Vercel Deployment

## Why Data Was Lost on Vercel:
Vercel uses serverless lambda functions. By default, SQLite stores data in `/tmp/sgpa.db`, which is ephemeral and wiped whenever Vercel restarts or cold-starts a serverless container.

## Solution: Connect a Free PostgreSQL Cloud Database

Follow these quick steps to make your database 100% persistent:

### Step 1: Create a Free PostgreSQL Database
You can create a free PostgreSQL database from any of the following providers in under 2 minutes:
- **Supabase**: [supabase.com](https://supabase.com) (Free Tier)
- **Neon**: [neon.tech](https://neon.tech) (Free Tier)
- **Render**: [render.com](https://render.com) (Free PostgreSQL)
- **Railway**: [railway.app](https://railway.app) (Free Tier)

### Step 2: Copy your PostgreSQL Connection String
Your connection URI will look like:
```text
postgresql://postgres.xxxx:your_password@aws-0-region.pooler.supabase.com:5432/postgres
```

### Step 3: Add `DATABASE_URL` to Vercel Environment Variables
1. Go to your **Vercel Dashboard** ([vercel.com/dashboard](https://vercel.com/dashboard)).
2. Select your `sgpa-cgpa-calculator` project.
3. Click **Settings** -> **Environment Variables**.
4. Add a new variable:
   - **Key**: `DATABASE_URL`
   - **Value**: `postgresql://postgres.xxxx:your_password@aws-0-region.pooler.supabase.com:5432/postgres`
   - **Target**: Select Production, Preview, and Development.
5. Click **Save**.
6. Add `JWT_SECRET_KEY` variable:
   - **Key**: `JWT_SECRET_KEY`
   - **Value**: `sgpa-secret-jwt-key-2026-super-secure-key-32bytes`
7. Re-deploy your project on Vercel (**Deployments** -> **Redeploy**).

---

Once `DATABASE_URL` is configured in Vercel, every registered user, password, semester, and subject will be stored in your PostgreSQL cloud database permanently. Data will NEVER be deleted or lost on logins, container restarts, or redeployments!
