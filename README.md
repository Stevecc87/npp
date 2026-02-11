# NeoOhio Underwriter

Internal real estate underwriting tool built with Next.js (App Router), TypeScript, and Supabase.

## Setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run the schema:
   - `supabase/schema.sql`
3. Create a Storage bucket named `lead-photos`.
4. In Supabase Auth, enable Email/Password provider.
5. Grab your project keys from Supabase settings.

## Environment Variables

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key # optional, enables real photo vision analysis
OPENAI_VISION_MODEL=gpt-4.1-mini # optional override
```

## Run Locally

```bash
npm install
npm run dev
```

## Team Rollout

- See `DEPLOYMENT.md` for production setup (recommended: GitHub + Vercel for shared URL + auto updates).

## Notes

- The app uses Supabase Auth email/password. Use the login screen to sign in or create a user.
- Photo analysis supports OpenAI vision when `OPENAI_API_KEY` is set; otherwise it safely falls back to heuristics.
- Storage access is restricted to authenticated users via RLS policies in `supabase/schema.sql`.
