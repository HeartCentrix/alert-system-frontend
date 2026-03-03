# Frontend Testing Configuration

## Test Stack

- **Test Runner:** Vitest (Vite-native, fast)
- **Testing Library:** React Testing Library
- **Mocking:** Vitest mocks, MSW for API
- **E2E:** Playwright (future)

## Setup

```bash
# Install test dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 msw
```

## Test Structure

```
src/
├── tests/
│   ├── setup.ts              # Test setup
│   ├── utils.tsx             # Test utilities
│   ├── components/           # Component tests
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── notifications/
│   │   └── common/
│   ├── hooks/                # Hook tests
│   ├── pages/                # Page tests
│   └── e2e/                  # E2E tests (Playwright)
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific file
npm test -- src/tests/components/auth/LoginForm.test.tsx

# Run E2E tests
npx playwright test
```

## Example Test

```tsx
// src/tests/components/auth/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginForm } from '@/components/auth/LoginForm'
import { describe, it, expect, vi } from 'vitest'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
})

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('LoginForm', () => {
  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
  })
  
  it('should login successfully with valid credentials', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password123!')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument()
    })
  })
})
```

## Coverage Configuration

Add to `vite.config.js`:

```js
export default defineConfig({
  // ... existing config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
```
