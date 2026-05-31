import { Auth0Provider, useAuth0, type AppState } from "@auth0/auth0-react";
import React, { useEffect } from "react";
import { privyAuthManager } from "./PrivyAuthManager";

type Auth0AuthProviderProps = {
  children: React.ReactNode;
};

type Auth0RuntimeConfig = {
  domain: string;
  clientId: string;
  audience?: string;
};

type Auth0Controls = {
  login: () => Promise<void>;
  logout: () => Promise<void> | void;
};

const noopControls: Auth0Controls = {
  login: async () => {
    window.dispatchEvent(new CustomEvent("hyperscape:local-auth-ready"));
  },
  logout: () => {},
};

export const auth0AuthControls: Auth0Controls = { ...noopControls };

function resolveAuth0Config(): Auth0RuntimeConfig | null {
  const runtimeEnv =
    typeof window !== "undefined"
      ? (
          window as Window & {
            env?: {
              PUBLIC_AUTH0_DOMAIN?: string;
              PUBLIC_AUTH0_CLIENT_ID?: string;
              PUBLIC_AUTH0_AUDIENCE?: string;
            };
          }
        ).env
      : undefined;
  const domain =
    runtimeEnv?.PUBLIC_AUTH0_DOMAIN || import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId =
    runtimeEnv?.PUBLIC_AUTH0_CLIENT_ID ||
    import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience =
    runtimeEnv?.PUBLIC_AUTH0_AUDIENCE || import.meta.env.PUBLIC_AUTH0_AUDIENCE;

  if (!domain || !clientId || clientId.includes("your-auth0-client-id")) {
    return null;
  }

  return { domain, clientId, audience: audience || undefined };
}

function Auth0StateBridge({ children }: Auth0AuthProviderProps) {
  const {
    error,
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  useEffect(() => {
    auth0AuthControls.login = () =>
      loginWithRedirect({
        appState: {
          returnTo: `${window.location.pathname}${window.location.search}`,
        },
      });
    auth0AuthControls.logout = () =>
      logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });

    window.auth0Logout = auth0AuthControls.logout;
    return () => {
      auth0AuthControls.login = noopControls.login;
      auth0AuthControls.logout = noopControls.logout;
      delete window.auth0Logout;
    };
  }, [loginWithRedirect, logout]);

  useEffect(() => {
    privyAuthManager.setPrivySdkReady(!isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user?.sub) {
      privyAuthManager.clearAuth();
      return;
    }

    let cancelled = false;
    const syncAuth0User = async () => {
      try {
        const token = await getAccessTokenSilently();
        if (cancelled) return;

        privyAuthManager.setAuthenticatedUser({ id: user.sub ?? "" }, token);
      } catch (err) {
        if (cancelled) return;
        console.warn("[Auth0AuthProvider] Failed to load Auth0 token:", err);
        privyAuthManager.clearAuth();
      }
    };

    void syncAuth0User();
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, isAuthenticated, isLoading, user?.sub]);

  useEffect(() => {
    if (error) {
      console.error("[Auth0AuthProvider] Auth0 error:", error);
    }
  }, [error]);

  return <>{children}</>;
}

function DisabledAuthProvider({ children }: Auth0AuthProviderProps) {
  useEffect(() => {
    privyAuthManager.setPrivySdkReady(true);
  }, []);

  return <>{children}</>;
}

export function Auth0AuthProvider({ children }: Auth0AuthProviderProps) {
  const config = resolveAuth0Config();

  if (!config) {
    return <DisabledAuthProvider>{children}</DisabledAuthProvider>;
  }

  const onRedirectCallback = (appState?: AppState) => {
    const target = appState?.returnTo || window.location.pathname;
    window.history.replaceState({}, document.title, target);
  };

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.audience,
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <Auth0StateBridge>{children}</Auth0StateBridge>
    </Auth0Provider>
  );
}
