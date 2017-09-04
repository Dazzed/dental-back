/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';
import stripe from '../stripe';
import moment from 'moment';

import {
  validateBody,
  validateParams,
  validatePaymentManager,
  verifyPasswordLocal,
} from '../middlewares';

import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../errors';

import { REFUND_POST_PARAMS } from '../../utils/schema-validators';

async function getRefundList(req, res) {

}

async function processRefund(req, res) {
  try {
    const { userId } = req.body;
    const amount = parseFloat(req.body.refundAmount) * 100;
    const paymentProfile = await db.PaymentProfile.findOne({ where: {primaryAccountHolder: userId } });
    if (!paymentProfile) {
      throw {errors: `PaymentProfile is not found for user id ${userId}`};
    }

    const chargesList = await stripe.listCharges(paymentProfile.stripeCustomerId);
    const localRefunds = await db.Refund.findAll({ where: { clientId: userId } });

    let localRefundsTotal = 0;
    const stripeChargesTotal = chargesList.data.reduce((acc, charge) => acc += charge.amount, 0);
    if (localRefunds.length > 0) {
      localRefundsTotal = localRefunds.reduce((acc, r) => acc += r.amount, 0);
    }

    if (localRefundsTotal >= stripeChargesTotal) {
      return res.status(400).send({errors: 'Maximum Refund amount exceeded. This user cannot be refunded any amount at this point.'});
    }
    if (amount > stripeChargesTotal) {
      return res.status(400).send({errors: `This User cannot be refunded more than ${stripeChargesTotal} dollars`});
    }

    let balance = amount;
    for (let charge of chargesList.data) {
      if (balance !== 0 && charge.amount_refunded < charge.amount) {
        if (balance > charge.amount) {
          await stripe.createRefund(charge.id, charge.amount);
          balance -= charge.amount;
        }
        else {
          await stripe.createRefund(charge.id, balance);
          balance = 0;
        }
      }
    }
    const userSubscription = await db.Subscription.findOne({
      where: {
        paymentProfileId: paymentProfile.id
      }
    });
    const refund = await db.Refund.create({
      clientId: userId,
      dentistId: userSubscription.dentistId,
      amount
    });
    return res.status(200).send({ message: `Refund amount of ${amount} dollars is processed successfully.` });
  } catch (e) {
    console.log("Error in processRefund");
    console.log(e);
    if (e.errors) {
      return res.status(400).send({errors: e.errors});
    }
    return res.status(500).send({ message: "There was an issue processing refund. Please try again later" });
  }
}

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getRefundList)
  .post(
    validateBody(REFUND_POST_PARAMS),
    processRefund
  );

export default router;
