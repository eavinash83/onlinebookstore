// Better Auth browser client. Same origin as the API, so no baseURL is needed and the session cookie just works.
// useSession() gives { data, isPending }; data is null when signed out.
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
