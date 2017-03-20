import { Router } from 'express';
// import passport from 'passport';

import {
  ADULT_MEMBERSHIP_ITEMS_DEFAULTS,
  CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS,
} from '../../config/constants';


const router = new Router({ mergeParams: true });


function getPricingCodes(req, res) {
  const pricingCodes = ADULT_MEMBERSHIP_ITEMS_DEFAULTS;
  Object.assign(pricingCodes, CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS);

  res.json({ data: pricingCodes });
}


router
  .route('/')
  .get(
    // passport.authenticate('jwt', { session: false }),
    getPricingCodes);

export default router;
