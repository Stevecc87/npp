# Deployment (Team Access + Auto Updates)

## Recommended: Vercel + GitHub (fastest for team)

This gives your team one URL and automatic updates whenever you push to `main`.

### 1) Put project in GitHub

```bash
cd /Users/stevencathcart/neohio-underwriter
git init
git add .
git commit -m "Initial production-ready underwriter"
# create empty repo on GitHub first, then:
git remote add origin git@github.com:<your-org-or-user>/neohio-underwriter.git
git branch -M main
git push -u origin main
```

### 2) Import into Vercel

1. Go to https://vercel.com/new
2. Import the GitHub repo
3. Framework: Next.js (auto-detected)
4. Add Environment Variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional but needed for real vision)
   - `OPENAI_VISION_MODEL` (`gpt-4.1-mini`)
5. Deploy

### 3) Share with team

- Send team the Vercel production URL.
- Each teammate signs in via Supabase auth credentials.

### 4) Publish updates

```bash
git add .
git commit -m "Your update"
git push
```

Vercel auto-deploys. Team gets latest version at the same URL.

---

## Alternative: Self-host with Docker (single VM/server)

### Run

```bash
cd /Users/stevencathcart/neohio-underwriter
docker compose up -d --build
```

App runs on `http://<server-ip>:3000`.

### Update

```bash
git pull
docker compose up -d --build
```

---

## Production checklist

- [ ] Supabase RLS policies applied (`supabase/schema.sql`)
- [ ] Storage bucket `lead-photos` exists
- [ ] Environment variables set in host (not committed)
- [ ] Team users created (or signup policy decided)
- [ ] Backups enabled in Supabase
