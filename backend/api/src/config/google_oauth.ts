import { OAuth2Client } from "google-auth-library";
import { requiredEnv } from "../../../shared/src/utils/require";


export const googleOAuthClient = new OAuth2Client({
  clientId: requiredEnv("GOOGLE_CLIENT_ID"),
  clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
  redirectUri: requiredEnv("GOOGLE_CALLBACK_URL"),
});


