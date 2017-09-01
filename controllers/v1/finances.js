// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';
import HTTPStatus from 'http-status';
import moment from 'moment';
import isPlainObject from 'is-plain-object';
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
async function getInvoices(req, res, next) {
  console.log(`params userID: ${req.params.userId}, local userID: ${req.user.get('id')}`);
  let userId = req.params.userId;

  console.log(`id ${req.user.id} addedBy ${req.user.addedBy}`);

  if (parseInt(req.params.userId) !== req.user.id) {
    return await next(new UnauthorizedError());
  }

  try {
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: req.user.addedBy || req.user.id,
      }
    });

    const stripeCustomerId = paymentProfile.stripeCustomerId;

    const invoices = await stripe.getInvoices(stripeCustomerId);

    return res.json(invoices);
  } catch (e) {
    return await next(new BadRequestError(e));
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    getInvoices);

export default router;
