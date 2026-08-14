import type { QueryClient } from "@tanstack/react-query";
import { type ChatMode, type UserSettings } from "@/lib/schemas";
import { getHomeDefaultChatMode } from "@/lib/homeChatMode";

export async function resolveFirstPromptDefaultChatMode({
  settings,
  envVars,
}: {
  settings: UserSettings;
  envVars: Record<string, string | undefined>;
  quotaStatus?: unknown;
  queryClient?: QueryClient;
}): Promise<ChatMode> {
  return getHomeDefaultChatMode(
    settings,
    envVars,
    true,
  );
}
