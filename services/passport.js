import passport from 'passport';
import {
  ExtractJwt,
  Strategy as JwtStrategy,
} from 'passport-jwt';

import db from '../models';

// passport.use(db.User.createStrategy());
//
// passport.serializeUser(db.User.serializeUser());
// passport.deserializeUser(db.User.deserializeUser());


// Setup options for JWT strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeader(),
  secretOrKey: process.env.JWT_SECRET
};

const initialUser = {
  'id': 1,
  'email': 'test@test.com',
  'firstName': 'Mike',
  'lastName': 'ODell',
  'addresses': [
    {
      'address1': '123 Main Street',
      'address2': '',
      'city': 'Atlanta',
      'state': 'Georgia',
      'zip': '12312'
    },
    {
      'address1': '123 Main Street',
      'address2': '',
      'city': 'Atlanta',
      'state': 'Georgia',
      'zip': '12312'
    }
  ],
  'members': [
    {
      'firstName': 'Stan',
      'lastName': 'Lee',
      'relationship': 'Son',
      'createdAt': '07-04-2016',
      'accountOwner': 'true',
      'type': 'Child',
      'fee': '$20.00',
      'avatar': 'http://www.teenink.com/images/default_face.gif',
    },
    {
      'firstName': 'Mike',
      'lastName': 'ODell',
      'relationship': 'Son',
      'createdAt': '07-04-2016',
      'accountOwner': 'false',
      'type': 'Adult',
      'fee': '$50.00',
      'avatar': 'http://www.iconpot.com/icon/preview/male-user-avatar.jpg',
    }
  ],
  'phones': [
    {
      'number': '123-123-1234',
      'type': 'Home'
    },
    {
      'number': '123-123-1234',
      'type': 'Mobile'
    }
  ],
  'dentist': [
    {
      'name': 'Dr. L Brett Wells, MD',
      'address': 'Raleigh, North Carolina',
      'description': 'Wells Family Dentistry is a leading family dental office in the heart of Raleigh, North Carolina.\n Dr. L Brett Wells and his team of industry experts aspire to provide a positive and comfortable dental experience for the people of the community.',
      'membershipFee': '$20',
      'childMembershipFee': '$17',
      'url': 'www.wellsfamilydental.com',
      'email': 'dentistinfo@example.com',
      'phone': '929-123-0231',
      'avatar': 'http://www.iconpot.com/icon/preview/male-user-avatar.jpg',
    }
  ]
};


// Create JWT strategy
const jwtLogin = new JwtStrategy(jwtOptions, (payload, done) => {
  return done(null, initialUser);
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
