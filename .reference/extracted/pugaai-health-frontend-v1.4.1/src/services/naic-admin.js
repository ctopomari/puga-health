export const NAIC_ADMIN_ROLES = new Set(['naic_admin', 'super_admin'])

export function isNaicAdminSession(session = {}) {
  return session?.status === 'authenticated' && NAIC_ADMIN_ROLES.has(session?.role)
}

export function canAccessNaicConsole(session = {}) {
  return isNaicAdminSession(session)
}

export function clearNaicAdminSession(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!storage) return
  storage.removeItem('pugaai-naic-admin-token')
  storage.removeItem('pugaai-naic-admin-state')
  storage.removeItem('pugaai-naic-admin-role')
}
