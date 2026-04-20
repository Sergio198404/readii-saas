export const ROLES = {
  CUSTOMER: 'customer',
  PARTNER: 'partner',
  CONSULTANT: 'consultant',
  ADMIN: 'admin',
}

export function getUserRoles(profile) {
  if (!profile) return []
  const roles = []
  if (profile.role_customer) roles.push(ROLES.CUSTOMER)
  if (profile.role_partner) roles.push(ROLES.PARTNER)
  if (profile.role_consultant) roles.push(ROLES.CONSULTANT)
  if (profile.role_admin) roles.push(ROLES.ADMIN)
  // Fallback: support old role field during transition
  if (roles.length === 0 && profile.role) {
    if (profile.role === 'admin') roles.push(ROLES.ADMIN)
    else if (profile.role === 'partner') roles.push(ROLES.PARTNER)
  }
  return roles
}

export function hasRole(profile, role) {
  return getUserRoles(profile).includes(role)
}

export function getDefaultRoute(profile) {
  const roles = getUserRoles(profile)
  if (roles.length === 0) return '/'
  if (roles.includes(ROLES.CUSTOMER)) return '/customer/dashboard'
  if (roles.includes(ROLES.PARTNER)) return '/partner/dashboard'
  if (roles.includes(ROLES.CONSULTANT)) return '/consultant/dashboard'
  if (roles.includes(ROLES.ADMIN)) return '/today'
  return '/'
}

export const ROLE_BASE_PATHS = {
  [ROLES.CUSTOMER]: '/customer',
  [ROLES.PARTNER]: '/partner',
  [ROLES.CONSULTANT]: '/consultant',
  [ROLES.ADMIN]: '/admin',
}

export function getRequiredRoleFromPath(pathname) {
  if (pathname.startsWith('/customer')) return ROLES.CUSTOMER
  if (pathname.startsWith('/partner')) return ROLES.PARTNER
  if (pathname.startsWith('/consultant')) return ROLES.CONSULTANT
  if (pathname.startsWith('/admin') || pathname.startsWith('/today') || pathname.startsWith('/board') || pathname.startsWith('/content') || pathname.startsWith('/experts')) return ROLES.ADMIN
  return null
}
