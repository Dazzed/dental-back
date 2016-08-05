import { Router } from 'express';
import passport from 'passport';

const router = new Router();


router
  .route('/me')
  .get(
    passport.authenticate('jwt', { session: false }),
    (req, res) => {
      res.json(req.user);
    }
  );


export default router;
