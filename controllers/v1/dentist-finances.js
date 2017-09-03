// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import HTTPStatus from 'http-status';
import moment from 'moment';
import stripe from '../stripe';
import db from '../../models';
import finances from '../finances';

import {
  BadRequestError,
  UnauthorizedError,
} from '../errors';

import {
  userRequired,
  dentistRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of invoices for a dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
async function getDentistFinances(req, res, next) {
  if (parseInt(req.params.dentistId) !== req.user.id) {
    return await next(new UnauthorizedError());
  }

  const year = (!isNaN(parseInt(req.params.year)) ? req.params.year : undefined) || moment().year();
  const month = (!isNaN(parseInt(req.params.month)) ? req.params.month : undefined) || moment().month();

  try {
    const subscriptions = await db.Subscription.findAll({
      where: { dentistId: req.user.id },
      include: [{
        model: db.PaymentProfile,
        as: 'paymentProfile',
        attributes: ['primaryAccountHolder', 'stripeCustomerId'],
      },
      {
        model: db.User,
        as: 'client',
        attributes: ['id', 'firstName', 'middleName', 'lastName'],
      }]
    });

    const queries = subscriptions.map(async (sub) => {
      const clientFinances = await finances.getUserFinances(sub.paymentProfile.primaryAccountHolder, year);
      return { client: sub.client, finances: clientFinances }
    });
    const invoiceLists = await Promise.all(queries)
    return res.json(invoiceLists);
  } catch (e) {
    return await next(new BadRequestError(e));
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/:year?/:month?').get(userRequired, dentistRequired, getDentistFinances);

export default router;
