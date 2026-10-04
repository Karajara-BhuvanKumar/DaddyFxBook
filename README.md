
# DaddyFxBook

XAUUSD (Gold) trading journal application with backtesting capabilities, built with React + TypeScript + Vite + Supabase.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:8080` to sign in to your existing account. The existing Supabase environment variables are required; see `.env.example`.

For a visual review without signing in, open `http://localhost:8080/preview`. This development-only page shows six local sample trades from September 2026. Its sample data is never saved to an account. The preview route is excluded from production builds, and normal account pages retain their existing sign-in protection.

## Documentation

All documentation is organized in the `docs/` directory:
- [Repository Structure](docs/REPOSITORY_STRUCTURE.md)
- [Audits](docs/audits/)
- [Migrations](docs/migration/)
- [Implementations](docs/implementation/)
- [Schema](docs/schema/)
- [Test Plans](docs/reports/)
