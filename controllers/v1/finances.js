// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';
import HTTPStatus from 'http-status';
import moment from 'moment';
import stripe from '../stripe';
import db from '../../models';

import {
  BadRequestError,
  UnauthorizedError,
} from '../errors';

import {
  userRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of invoice line items for a user
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
async function getFinances(req, res, next) {
  if (parseInt(req.params.userId) !== req.user.id) {
    return await next(new UnauthorizedError());
  }

  const year = (!isNaN(parseInt(req.params.year)) ? req.params.year : undefined) || moment().format('Y');

  try {
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: req.user.addedBy || req.user.id,
      }
    });
    const stripeCustomerId = paymentProfile.stripeCustomerId;
    const [invoices, charges] = await Promise.all([
      stripe.getInvoices(stripeCustomerId, year),
      stripe.getCharges(stripeCustomerId, year)
    ]);

    return res.json({invoices, charges});
  } catch (e) {
    return await next(new BadRequestError(e));
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/:year?').get(userRequired, getFinances);

export default router;
