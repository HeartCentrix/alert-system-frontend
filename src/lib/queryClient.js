import { QueryClient, MutationCache } from '@tanstack/react-query'

// Single shared QueryClient so both the React tree (main.jsx) and the axios
// layer (services/api.js) can reach it. The api interceptor invalidates queries
// after every successful mutation so the UI always reflects changes without a
// manual page reload.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Refresh when the user returns to the tab or reconnects.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
  // Catch-all for mutations made via useMutation. (Direct api.* mutations are
  // handled by the response interceptor in services/api.js.)
  mutationCache: new MutationCache({
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  }),
})
