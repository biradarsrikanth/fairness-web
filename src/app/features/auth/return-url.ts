/**
 * Where to go after signing in. Only a path inside this app: "//host" or "https://..." in the query
 * string would otherwise send the user to another site (an open redirect).
 */
export function safeReturnUrl(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return '/';
  if (url.startsWith('/login') || url.startsWith('/change-password')) return '/';
  return url;
}
