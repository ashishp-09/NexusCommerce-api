import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userService from '../../Database/User-Service.js';

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

passport.use(
  new GoogleStrategy(
    {
      callbackURL: 'auth/google/redirect',
      clientID: process.env.clientID!,
      clientSecret: process.env.clientSecret!,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = userService.findUserByGoogleId(profile.id);

        if (!user) {
          const newUser = await userService.createUser({
            email: profile.emails?.[0]?.value ?? null,
            password: null,
            username: profile.displayName || profile.id,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            googleId: profile.id,
          });
          return done(null, newUser);
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);
