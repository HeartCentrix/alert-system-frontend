# GitHub Actions Workflows

This directory contains the CI/CD pipeline configuration for the TM Alert Frontend.

## Workflow Files

### `ci-cd.yml` - Main CI/CD Pipeline

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual dispatch with environment selection

**Stages:**

| Stage | Description | Timeout |
|-------|-------------|---------|
| **Lint** | ESLint + TypeScript type checking | 10 min |
| **Test** | Unit & component tests with Vitest | 20 min |
| **Component Tests** | Detailed component testing with JUnit reports | 15 min |
| **Build** | Production build verification | 15 min |
| **E2E Tests** | Playwright end-to-end tests (main only) | 30 min |
| **Deploy (Prod)** | Deploy to Vercel Production (main only) | 15 min |
| **Deploy (Staging)** | Deploy to Vercel Preview (develop only) | 15 min |

**Features:**
- ✅ Automatic cancellation of in-progress PR builds
- ✅ Coverage reporting to Codecov
- ✅ JUnit test reports
- ✅ Build artifact preservation
- ✅ Environment-specific deployments
- ✅ Pipeline summary generation

## Required Secrets

Configure these in GitHub Repository Settings → Secrets and variables → Actions:

| Secret | Description | Required |
|--------|-------------|----------|
| `VERCEL_TOKEN` | Vercel authentication token | ✅ Yes |
| `VERCEL_ORG_ID` | Vercel organization ID | ✅ Yes |
| `VERCEL_PROJECT_ID` | Vercel project ID | ✅ Yes |
| `CODECOV_TOKEN` | Codecov upload token | Optional |

## Getting Vercel Secrets

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link project: `vercel link`
4. Get secrets:
   ```bash
   vercel ls --token <your-token>
   # Or extract from ~/.vercel/config.json
   ```

## Manual Workflow Dispatch

You can manually trigger the workflow:

1. Go to **Actions** tab
2. Select **Frontend CI/CD** workflow
3. Click **Run workflow**
4. Choose environment (staging/production)
5. Click **Run workflow**

## Skipping CI

Add to your commit message to skip CI:
```
[skip ci]
[ci skip]
```

Or add these paths to `.github/workflows/ci-cd.yml`:
```yaml
paths-ignore:
  - '**.md'
  - 'docs/**'
```

## Coverage Thresholds

Configure in `vite.config.js`:

```js
test: {
  coverage: {
    threshold: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80
    }
  }
}
```

## Troubleshooting

### Workflow Not Running

1. Check if branch is `main` or `develop`
2. Verify `.github/workflows/ci-cd.yml` syntax
3. Check GitHub Actions billing (minutes limit)

### Tests Failing in CI but Pass Locally

1. Check environment variables
2. Verify Node.js version matches (18.x)
3. Clear cache: `rm -rf node_modules package-lock.json && npm install`

### Deployment Fails

1. Verify Vercel secrets are correct
2. Check Vercel project settings
3. Review deployment logs in Vercel dashboard

## Related Documentation

- [TESTING.md](../TESTING.md) - Testing setup and examples
- [README.md](../README.md) - Project overview
- [Vercel Deployment](https://vercel.com/docs/deployments/overview) - Vercel docs
