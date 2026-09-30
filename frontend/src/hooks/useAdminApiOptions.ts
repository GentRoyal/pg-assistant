import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import type { AdminApiOptions } from '../lib/adminApi'

/** Auth + API base for live admin calls (ignored while USE_MOCK_ADMIN is true). */
export function useAdminApiOptions(): AdminApiOptions {
  const { token } = useAuth()
  const { settings } = useSettings()
  return useMemo(
    () => ({
      token: token ?? undefined,
      apiBaseUrl: settings.apiBaseUrl,
    }),
    [token, settings.apiBaseUrl],
  )
}
