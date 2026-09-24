import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userService from '../../database/User-Service.js';
import config from '../../config/nexus.config.js';

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userService.findUserById(id);
    if (user) {
      done(null, user);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (err) {
    done(err instanceof Error ? err : new Error('Unknown error'), null);
  }
});

const clientID = process.env.GOOGLE_CLIENT_ID || config.oauth.google.clientId || 'google_client_id';
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || config.oauth.google.clientSecret || 'google_client_secret';
const callbackURL = process.env.GOOGLE_CALLBACK_URL || config.oauth.google.callbackUrl;

if (clientID && clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        callbackURL,
        clientID,
        clientSecret,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await userService.findUserByGoogleId(profile.id);

          if (!user) {
            user = await userService.createUser({
              email: profile.emails?.[0]?.value ?? `${profile.id}@google.com`,
              password: null,
              username: profile.displayName || profile.id,
              firstName: profile.name?.givenName || 'User',
              lastName: profile.name?.familyName || 'Google',
              googleId: profile.id,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}
