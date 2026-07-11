import { useCallback } from "react";
import { useAuth, useClerk } from "@clerk/react";

/**
 * Gate an action behind sign-in. Returns `requireAuth(action)`, which wraps a
 * handler so it only runs when the user is signed in; otherwise it opens the
 * Clerk sign-in modal. Used to protect saving jobs and applying to roles.
 */
export function useAuthGate() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  return useCallback(
    (action) =>
      (...args) => {
        if (isSignedIn) return action?.(...args);
        openSignIn();
        return undefined;
      },
    [isSignedIn, openSignIn]
  );
}
