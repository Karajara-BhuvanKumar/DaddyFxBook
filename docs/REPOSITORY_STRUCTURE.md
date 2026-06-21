
# DaddyFxBook Repository Structure

## Root Directory
```
DaddyFxBook/
├── docs/
│   ├── audits/
│   ├── migration/
│   ├── implementation/
│   ├── schema/
│   ├── reports/
│   └── REPOSITORY_STRUCTURE.md
├── src/
│   └── (unchanged frontend application code)
├── public/
│   └── (unchanged static assets)
├── supabase/
│   ├── functions/
│   │   ├── ai-report/
│   │   ├── ai-insights/
│   │   ├── backtest-ai/
│   │   ├── market-ai/
│   │   └── market-events/
│   └── migrations/
│       └── 0000_initial_schema.sql
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example
├── .gitignore
└── README.md
```

## Docs Directory Breakdown
### docs/audits/
- **EDGE_FUNCTIONS_AUDIT.md**: Audit of all Supabase Edge Functions
- **FUNCTIONS_AUDIT.md**: Another audit of Supabase Edge Functions
- **LOVABLE_DEPENDENCY_AUDIT.md**: Audit of Lovable AI platform dependencies
- **SECRETS_AUDIT.md**: Audit of API keys and secrets
- **SUPABASE_CLIENT_AUDIT.md**: Audit of Supabase client initialization and usage
- **SUPABASE_TYPES_AUDIT.md**: Audit of Supabase TypeScript types
- **SCHEMA_VERIFICATION.md**: Audit and verification of the database schema

### docs/migration/
- **AI_FUNCTIONS_MIGRATION.md**: Report of AI functions migration
- **BACKEND_MIGRATION_ROADMAP.md**: Roadmap for backend migration
- **BACKEND_CLEANUP_PLAN.md**: Plan for cleaning up the backend
- **DATABASE_MIGRATION_PLAN.md**: Database migration planning
- **DB_PUSH_READINESS.md**: Verification report for pushing to Supabase
- **LINT_PRECHECK.md**: Pre-check report for Supabase DB linting
- **MIGRATION_CHECKLIST.md**: Checklist for migration steps
- **MIGRATION_EXECUTION_GUIDE.md**: Step-by-step guide for migration execution
- **SUPABASE_ENV_MIGRATION.md**: Migration of Supabase environment variables

### docs/implementation/
- **AI_REPORT_IMPLEMENTATION.md**: AI report feature implementation
- **GEMINI_INTEGRATION_PLAN.md**: Plan for integrating Google Gemini API

### docs/schema/
- **FINAL_PRODUCTION_SCHEMA.sql**: Full production database schema SQL file

### docs/reports/
- **FRONTEND_DATABASE_TEST_PLAN.md**: Test plan for frontend/database integration
- **POST_MIGRATION_TEST_PLAN.md**: Test plan for after-migration verification
