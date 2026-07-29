'use client';

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider basePath="/aura/api/auth">{children}</SessionProvider>;
}
