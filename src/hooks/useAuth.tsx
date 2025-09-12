// Referenced from blueprint:javascript_auth_all_persistance integration
import React, { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";

// User interface
interface User {
  id: string;
  username: string;
  email?: string;
  isGuest?: boolean;
}

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  continueAsGuestMutation: UseMutationResult<User, Error, void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

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

// Helper function for API requests with CSRF token support
async function apiRequest(method: string, url: string, data?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  let requestBody = data;
  
  // Add CSRF token for state-changing requests
  if (method !== 'GET') {
    const csrfToken = await getCsrfToken();
    // Add CSRF token to request body (tiny-csrf expects it in body._csrf)
    requestBody = {
      ...data,
      _csrf: csrfToken
    };
  }
  
  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include', // Important for session cookies
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  return response;
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        return await res.json();
      } catch (error) {
        // If user is not authenticated, return null instead of throwing
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
  });

  const continueAsGuestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/guest/continue");
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        continueAsGuestMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}