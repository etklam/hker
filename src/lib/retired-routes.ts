export const retiredPaths = [
  '/bills', '/spaces', '/me', '/marketplace', '/tools', '/invite', '/register', '/admin/users',
  '/api/me', '/api/admin/stats', '/api/admin/collections', '/api/monthly-bills', '/api/spaces',
  '/api/collections', '/api/links', '/api/invites', '/api/marketplace', '/api/subscriptions',
  '/api/featured', '/api/auth/register', '/api/admin/users', '/api/admin/marketplace',
];

export function isRetiredPath(pathname: string) {
  return retiredPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function retiredResponse() {
  return Response.json({ code: 'RETIRED', message: '此功能已停用。' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
