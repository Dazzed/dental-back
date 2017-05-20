// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import passport from 'passport';
import {
  ExtractJwt,
  Strategy as JwtStrategy,
} from 'passport-jwt';

import db from '../models';

// ────────────────────────────────────────────────────────────────────────────────
// PASSPORT

passport.use(db.User.createStrategy());

passport.serializeUser(db.User.serializeUser());
passport.deserializeUser(db.User.deserializeUser());

// Setup options for JWT strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeader(),
  secretOrKey: process.env.JWT_SECRET
};

// Create JWT strategy
const jwtLogin = new JwtStrategy(jwtOptions, (payload, done) => {
  // See if the user ID in hte payload exists. If so, call done with that user
  // otherwise call without a user object
  const query = db.User.getActiveUser(payload.id);

  query.then((user) => {
    done(null, user);
  });

  query.catch((err) => {
    done(err);
  });
});

passport.use(jwtLogin);
