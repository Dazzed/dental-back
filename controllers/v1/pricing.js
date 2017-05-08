import { Router } from 'express';
import _ from 'lodash';

import db from '../../models';
import { userRequired, dentistRequired } from '../middlewares';
import { NEW_PRICING_CODE } from '../../utils/schema-validators';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const router = new Router({ mergeParams: true });

const VISIBLE_COLUMNS = [
  'description', 'code'
];

/**
 * Retrieves a list of price codes created by all dentist offices
 *
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getPricingCodes(req, res) {
  db.PriceCodes.findAll({}).then(codes => {
    codes = codes.map(c => _.pick(c, VISIBLE_COLUMNS));
    res.json({ data: codes });
  });
}

function savePriceCode(req, res) {
  req.checkBody(NEW_PRICING_CODE);

  db.PriceCodes.findOrCreate({
    where: req.body,
    returning: true,
  }).then(code => {
    res.json({ data: _.pick(code.shift(), VISIBLE_COLUMNS) });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

router.route('/')
  .get(userRequired, getPricingCodes)
  .post(userRequired, dentistRequired, savePriceCode);

export default router;
