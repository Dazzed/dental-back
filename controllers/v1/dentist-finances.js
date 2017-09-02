// ────────────────────────────────────────────────────────────────────────────────
// MODULES

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
  dentistRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

async function getStripeCustomerId(userId) {
  return db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: userId,
      }
    });
}

/**
 * Gets a list of invoices for a dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
async function getInvoices(req, res, next) {
  console.log(`params userID: ${req.params.userId}, local userID: ${req.user.get('id')}`);
  console.log(`id ${req.user.id} addedBy ${req.user.addedBy}`);


  if (parseInt(req.params.dentistId) !== req.user.id) {
    return await next(new UnauthorizedError());
  }

  try {
    const subscriptions = await db.Subscription.findAll({
      where: { dentistId: req.user.id },
      include: [{
        model: db.PaymentProfile,
        as: 'paymentProfile',
        attributes: ['stripeCustomerId'],
      },
      {
        model: db.User,
        as: 'client',
        attributes: ['firstName', 'middleName', 'lastName'],
      }]
    });

    const queries = subscriptions.map(async (sub) => {
      const invoices = await stripe.getInvoices(sub.paymentProfile.stripeCustomerId);
      return {client: sub.client, invoices}
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

router.route('/').get(userRequired, dentistRequired, getInvoices);

export default router;
