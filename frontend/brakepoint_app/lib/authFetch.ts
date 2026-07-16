const API_URL = process.env.NEXT_PUBLIC_API_URL;

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the access token using the stored refresh token.
 * De-duplicates concurrent refresh attempts so only one request is made.
 */
async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refresh_token")
        : null;

    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/api/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token", data.access);
        return data.access as string;
      }

      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Drop-in replacement for `fetch` that automatically:
 *   1. Attaches the stored JWT access token as a Bearer header
 *   2. On 401, attempts a silent token refresh and retries once
 *   3. If the refresh also fails, clears stored tokens and redirects to /logIn
 *      You can also change this by setting the onFail variable to add different functionality
 *      and redirectToLogin = false to disable this automatic direct.
 *
 * Usage:
 *   const res = await authFetch(`${API_URL}/api/cameras/`);
 *   // ...or with extra options:
 *   const res = await authFetch(url, { method: 'POST', body: formData });
 */
export async function authFetch(
  url: string,
  options: RequestInit = {},
  onFail: (response?: any) => void = () => {},
  redirectToLogin: boolean = true,
): Promise<Response> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const mergedHeaders: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response = await fetch(url, { ...options, headers: mergedHeaders });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry the original request with the fresh token
      const retryHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string>),
        Authorization: `Bearer ${newToken}`,
      };
      response = await fetch(url, { ...options, headers: retryHeaders });
    } else {
      // Refresh failed → force re-login
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");

        onFail(response);
        if (redirectToLogin) window.location.href = "/logIn";
      }
      // Throw so callers' catch blocks can handle this as a real error
      throw new Error("Session expired. Please log in again.");
    }
  }

  return response;
}
