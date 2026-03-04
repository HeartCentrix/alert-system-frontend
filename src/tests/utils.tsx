/**
 * Test Utilities
 * 
 * Common utilities and helpers for tests
 */
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { RenderOptions, ReactElement } from '@testing-library/react';
import { ReactNode } from 'react';

/**
 * Create a test QueryClient with safe defaults
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
}

/**
 * Test Providers Wrapper
 * Wraps components with necessary providers for testing
 */
function TestProviders({
  children,
  queryClient,
  initialEntries,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  initialEntries?: string[];
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter initialEntries={initialEntries || ['/']}>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Custom render function with providers
 * 
 * @param ui - Component to render
 * @param options - Render options
 * @returns Render result
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    initialEntries,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders
        queryClient={queryClient}
        initialEntries={initialEntries}
      >
        {children}
      </TestProviders>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'viewer',
    is_active: true,
    is_verified: true,
    ...overrides,
  };
}

/**
 * Create a mock location object
 */
export function createMockLocation(overrides = {}) {
  return {
    id: 1,
    name: 'Test Location',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zip_code: '12345',
    country: 'USA',
    latitude: 40.7128,
    longitude: -74.006,
    geofence_radius_miles: 1.0,
    is_active: true,
    ...overrides,
  };
}

/**
 * Create a mock notification object
 */
export function createMockNotification(overrides = {}) {
  return {
    id: 1,
    title: 'Test Notification',
    message: 'This is a test notification',
    status: 'sent',
    channels: ['sms', 'email'],
    total_recipients: 10,
    sent_count: 10,
    delivered_count: 9,
    failed_count: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Wait for element to be removed from DOM
 */
export async function waitForElementToBeRemoved(
  getElement: () => HTMLElement | null,
  timeout = 1000
) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      if (!getElement()) {
        return;
      }
    } catch (e) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw new Error('Element was not removed within timeout');
}

/**
 * Mock API response
 */
export function createMockApiResponse(data: any, success = true) {
  return {
    success,
    data,
    message: success ? 'Success' : 'Error',
  };
}
