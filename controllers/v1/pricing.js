// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';

import db from '../../models';
import { userRequired, dentistRequired, validateBody } from '../middlewares';
import { NEW_PRICING_CODE } from '../../utils/schema-validators';

import { BadRequestError, ForbiddenError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const VISIBLE_COLUMNS = ['id', 'code', 'description'];

/**
 * Retrieves a list of price codes created by all dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getPricingCodes(req, res, next) {
  db.PriceCodes.findAll({}).then((codes) => {
    codes = codes.map(c => _.pick(c, VISIBLE_COLUMNS));
    res.json({ data: codes });
  }).catch(err => next({ data: new ForbiddenError(err) }));
}

/**
 * Saves a new price code record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function savePriceCode(req, res, next) {
  db.PriceCodes.findOrCreate({
    where: req.body,
    returning: true,
  }).then((code) => {
    res.json({ data: _.pick(code.shift(), VISIBLE_COLUMNS) });
  }).catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/')
  .get(
    getPricingCodes)
  .post(
    userRequired,
    dentistRequired,
    validateBody(NEW_PRICING_CODE),
    savePriceCode);

export default router;
