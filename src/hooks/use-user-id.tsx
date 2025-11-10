import { useAuth } from "./useAuth";

export function useUserId() {
  const { user } = useAuth();
  return user?.id || null;
}