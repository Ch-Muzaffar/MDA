import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { type UserSettings, hasDyadProKey } from "@/lib/schemas";
import { queryKeys } from "@/lib/queryKeys";

const TELEMETRY_CONSENT_KEY = "dyadTelemetryConsent";
const TELEMETRY_USER_ID_KEY = "dyadTelemetryUserId";
const DYAD_PRO_STATUS_KEY = "dyadProStatus";

export function isTelemetryOptedIn() {
  return window.localStorage.getItem(TELEMETRY_CONSENT_KEY) === "opted_in";
}

export function getTelemetryUserId(): string | null {
  return window.localStorage.getItem(TELEMETRY_USER_ID_KEY);
}

export function isDyadProUser(): boolean {
  return window.localStorage.getItem(DYAD_PRO_STATUS_KEY) === "true";
}

let initialLoadTelemetryState: "idle" | "sent" = "idle";



export function useSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.user,
    queryFn: () => ipc.settings.getUserSettings(),
  });

  const envVarsQuery = useQuery({
    queryKey: queryKeys.settings.envVars,
    queryFn: () => ipc.misc.getEnvVars(),
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    processSettingsForTelemetry(settingsQuery.data);
  }, [settingsQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      return ipc.settings.setUserSettings(newSettings);
    },
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKeys.settings.user, updatedSettings);
      processSettingsForTelemetry(updatedSettings);
    },
    meta: { showErrorToast: true },
  });
  const updateSettingsMutationRef = useRef(updateSettingsMutation);
  updateSettingsMutationRef.current = updateSettingsMutation;

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      return updateSettingsMutationRef.current.mutateAsync(newSettings);
    },
    [],
  );

  const refreshSettings = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.settings.all,
    });
  }, [queryClient]);

  const loading = settingsQuery.isLoading || envVarsQuery.isLoading;
  const error = settingsQuery.error || envVarsQuery.error || null;

  return {
    settings: settingsQuery.data ?? null,
    envVars: envVarsQuery.data ?? {},
    loading,
    error,
    updateSettings,
    refreshSettings,
  };
}

function processSettingsForTelemetry(settings: UserSettings) {
  if (settings.telemetryConsent) {
    window.localStorage.setItem(
      TELEMETRY_CONSENT_KEY,
      settings.telemetryConsent,
    );
  } else {
    window.localStorage.removeItem(TELEMETRY_CONSENT_KEY);
  }
  if (settings.telemetryUserId) {
    window.localStorage.setItem(
      TELEMETRY_USER_ID_KEY,
      settings.telemetryUserId,
    );
  } else {
    window.localStorage.removeItem(TELEMETRY_USER_ID_KEY);
  }
  window.localStorage.setItem(
    DYAD_PRO_STATUS_KEY,
    hasDyadProKey(settings) ? "true" : "false",
  );
}
