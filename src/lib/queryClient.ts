import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Helper function to fetch CSRF token
async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/csrf', {
    method: 'GET',
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  
  const data = await response.json();
  return data.csrfToken;
}

export async function apiRequest(
  method: string,
  url: string,
  body?: any,
  userId?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-ID': userId } : {}),
  };
  
  let requestBody = body;
  
  // Add CSRF token for state-changing requests
  if (method !== 'GET') {
    const csrfToken = await getCsrfToken();
    // Send both header and body token to satisfy environments/proxies
    headers['csrf-token'] = csrfToken;
    requestBody = { ...body, _csrf: csrfToken };
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  };

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = new Error(`${response.status}: ${response.statusText}`);
    throw error;
  }
  
  return response;
}