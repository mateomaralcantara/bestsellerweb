"use client";

import { createClient } from "@/lib/supabase/client";

type BrowserSupabaseClient = ReturnType<typeof createClient>;

let browserClient: BrowserSupabaseClient | null = null;

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}