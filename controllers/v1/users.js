import { Router } from 'express';
import passport from 'passport';

import db from '../../models';


const router = new Router();


function getUser(req, res, next, userId) {
  db.User.getUser(userId).then((user) => {
    req.locals.user = user;  // eslint-disable-line no-param-reassign
    next();
  }).catch((error) => {
    next(error);
  });
}


// Bind to routes

router.param('userId', getUser);


router
  .route('/me')
  .get(
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );


router
  .route('/:userId')
  .get(
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );


export default router;
