/* eslint-disable no-inner-declarations */
import { Router } from 'express';

import { subscriptionChargeFailedNotification } from '../sendgrid_mailer';
import db from '../../models';
import stripe from '../stripe';
import invoicePaymentSucceeded from '../../utils/invoice_payment_succeeded_webhook';
import chargeSucceededWebhook from '../../utils/charge_succeeded_webhook';
import invoiceCreatedWebhook from '../../utils/invoice_created_webhook';
import invoicePaymentFailedWebhook from '../../utils/invoice_payment_failed_webhook';

const async = require('async');

const router = new Router({ mergeParams: true });

function stripe_webhook(request, response) {
  const { body } = request;

  if (body.type === 'charge.succeeded') {
    chargeSucceededWebhook(body);
  }

  else if (body.type === 'invoice.payment_failed') {
    invoicePaymentFailedWebhook(body);
  }

  else if (body.type === 'invoice.created') {
    invoiceCreatedWebhook(body);
  }

  else if (body.type === 'invoice.payment_succeeded') {
    invoicePaymentSucceeded(body);
  }
  return response.status(200).send({});
}

router
  .route('/stripe_webhook')
  .post(stripe_webhook);

export default router;

