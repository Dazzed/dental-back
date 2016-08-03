import passport from 'passport';

import './services/passport';
import v1 from './controllers/v1';

// const Authentication = require('./controllers/authentication');

const requireAuth = passport.authenticate('jwt', { session: false });
// const requireSignin = passport.authenticate('local', { session: false });


module.exports = (app) => {
  app.use('/api/v1', v1);

  // app.get('/', requireAuth, function(req, res) {
  //   res.send({hi: 'there'});
  // });

  // app.post('/signin', requireSignin, Authentication.signin);
  // app.post('/signup', Authentication.signup);
};
