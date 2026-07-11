import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setTokenGetter } from "../services/authToken.js";

/**
 * Hand Clerk's session-token getter to the service layer, which lives outside
 * React and so cannot reach useAuth() on its own. Without this the AI routes
 * would see every caller as signed out.
 */
export function useApiAuth() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);
}
