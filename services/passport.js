import passport from 'passport';
import {
  ExtractJwt,
  Strategy as JwtStrategy,
} from 'passport-jwt';

import db from '../models';
import config from '../config/server';

passport.use(db.users.createStrategy());

passport.serializeUser(db.users.serializeUser());
passport.deserializeUser(db.users.deserializeUser());

// Setup options for JWT strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: config.secret
};

// Create JWT strategy
const jwtLogin = new JwtStrategy(jwtOptions, (payload, done) => {
  // See if the user ID in hte payload exists. If so, call done with that user
  // otherwise call without a user object
  const query = db.User.findById(payload.sub);

  query.then((user) => {
    done(null, user);
  });

  query.catch((err) => {
    done(err);
  });
});


passport.use(jwtLogin);
