"use client";

/**
 * Client-only providers live here (React Query, theme, etc.)
 * This file runs on the client and can render client components safely.
 */
import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: ReactNode }) {
  // create one QueryClient per app on the client
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
