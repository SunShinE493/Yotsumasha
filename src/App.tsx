// Referenced from blueprint:javascript_auth_all_persistance integration
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Toaster } from "@/components/ui/toaster";
import Home from './pages/home';
import AuthPage from './pages/auth-page';
import TestPage from './pages/test';
import Landing from './pages/landing';
import BattlePage from './pages/battle';
import ScorePage from './pages/score';
import RankingPage from './pages/ranking';
import DevToolsPage from './pages/dev';
import CampfirePage from './pages/campfire';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  const { user, isLoading } = useAuth();                          console.log("AppRouter - user:", user, "isLoading:", isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-border mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const Redirect = ({ to }: { to: string }) => {
    window.location.replace(to);
    return null;
  };

  return (
    <Switch>
      {/* Auth routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />

      {user ? (
        <>
          {/* Logged-in routes */}
          <Route path="/" component={Landing} />
          <Route path="/study" component={Home} />
          <Route path="/test" component={TestPage} />
          <Route path="/battle" component={BattlePage} />
          <Route path="/score" component={ScorePage} />
          <Route path="/ranking" component={RankingPage} />
          <Route path="/campfire" component={CampfirePage} />
          {/* Dev route (no link from home) */}
          <Route path="/dev" component={DevToolsPage} />
          <Route>
            <Redirect to="/" />
          </Route>
        </>
      ) : (
        <>
          {/* Not logged in: send to /auth on any route (including /) */}
          <Route path="/">
            <Redirect to="/auth" />
          </Route>
          <Route>
            <Redirect to="/auth" />
          </Route>
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;