// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';

import db from '../../models';
import { userRequired, dentistRequired, validateBody } from '../middlewares';
import { NEW_PRICING_CODE } from '../../utils/schema-validators';

import { ForbiddenError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const VISIBLE_COLUMNS = ['id', 'code', 'description'];

/**
 * Retrieves a list of price codes created by all dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getPricingCodes(req, res) {
  db.PriceCodes.findAll({}).then((codes) => {
    codes = codes.map(c => _.pick(c, VISIBLE_COLUMNS));
    res.json({ data: codes });
  }).catch(err => res.json({ data: new ForbiddenError(err) }));
}

/**
 * Saves a new price code record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function savePriceCode(req, res) {
  db.PriceCodes.findOrCreate({
    where: req.body,
    returning: true,
  }).then((code) => {
    res.json({ data: _.pick(code.shift(), VISIBLE_COLUMNS) });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/')
  .get(
    userRequired,
    getPricingCodes)
  .post(
    userRequired,
    dentistRequired,
    validateBody(NEW_PRICING_CODE),
    savePriceCode);

export default router;
