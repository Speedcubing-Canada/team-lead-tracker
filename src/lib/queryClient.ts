import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

const queryDefaults = {
  // WCIF data changes rarely during a comp day; cache aggressively.
  staleTime: 5 * 60 * 1000,
  retry: 1,
} satisfies DefaultOptions["queries"];

export function createQueryClient(overrides: DefaultOptions["queries"] = {}): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { ...queryDefaults, ...overrides } } });
}
