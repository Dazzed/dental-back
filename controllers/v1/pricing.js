import { Router } from 'express';
// import passport from 'passport';

import {
  // ADULT_MEMBERSHIP_ITEMS_DEFAULTS,
  // CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS,
  PRICING_CODES
} from '../../config/constants';


const router = new Router({ mergeParams: true });


function getPricingCodes(req, res) {
  res.json({ data: PRICING_CODES });
}


router
  .route('/')
  .get(
    // passport.authenticate('jwt', { session: false }),
    getPricingCodes);

export default router;
