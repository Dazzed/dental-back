import { Router } from 'express';

import { subscriptionChargeFailedNotification } from '../sendgrid_mailer';
import db from '../../models';
import stripe from '../stripe';
import invoicePaymentSucceeded from '../../utils/invoice_payment_succeeded_webhook';
import chargeSucceededWebhook from '../../utils/charge_succeeded_webhook';
import invoiceCreatedWebhook from '../../utils/invoice_created_webhook';

const async = require('async');

const router = new Router({ mergeParams: true });

function stripe_webhook(request, response) {
  var { body } = request;
  console.log(`webhook event: ${body.type}`);

  // cast a wide net for identifying dirty cache items
  if (body.type.startsWith('invoice') || body.type.startsWith('charge')) {
    const stripeCustomerId = body.data.object.customer;
    const timestamp = body.type.startsWith('invoice') ? body.data.object.date : body.data.object.created;
    const invoiceYear = moment.unix(timestamp).year().toString();
    console.log(`updating cached charge response for customer ${stripeCustomerId}, year ${invoiceYear}`);
    stripe.getCharges(stripeCustomerId, invoiceYear, true);
  }

  if (body.type === 'charge.succeeded') {
    chargeSucceededWebhook(body);
  }

  else if (body.type == "charge.failed") {
    const invoiceId = body.data.object.invoice;
    const customerId = body.data.object.customer;

    function pluckIntervaltype(callback) {
      stripe.getInvoice(invoiceId).then(invoice => {
        const isMonthlyPlan = invoice.lines.data.some(line => line.plan.interval === 'month');
        const isAnnualPlan = invoice.lines.data.some(line => line.plan.interval === 'year');
        const stripeSubscriptionId = invoice.subscription;
        const attempt_count = invoice.attempt_count;
        // if (isAnnualPlan) {
        //   return callback('ok', isAnnualPlan, { stripeSubscriptionId });
        // }
        return callback(null, attempt_count, stripeSubscriptionId);
      }, err => {
        return callback(err);
      })
    }

    function performLocalActions(attempt_count, stripeSubscriptionId, callback) {
      let status;
      let updateObject = {};
      if (attempt_count === 1) {
        status = 'late';
        updateObject = {
          status
        };
      } else if (attempt_count === 4) {
        status = 'canceled';
        updateObject = {
          status,
          stripeSubscriptionId: null,
          stripeSubscriptionItemId: null,
          membershipId: null,
        };
      }
      if (Object.keys(updateObject).length > 0) {
        db.Subscription.update(updateObject,
          {
            where: {
              stripeSubscriptionId
            }
          }).then(subscriptions => {
            return callback(null, attempt_count);
          }, err => callback(err));
      } else {
        return callback(null, attempt_count);
      }
    }

    function sendMailToCustomer(attempt_count, callback) {
      db.PaymentProfile.findOne({
        where: stripeCustomerId
      })
        .then(profile => {
          db.User.findOne({
            where: {
              id: profile.primaryAccountHolder
            }
          }).then(user => {
            subscriptionChargeFailedNotification(user, attempt_count);
            callback(null, true);
          }, err => callback(err));
        }, err => callback(err));

    }

    async.waterfall(
      [
        pluckIntervaltype,
        performLocalActions,
        sendMailToCustomer
      ]
      , (err, isAnnualPlan, data) => {
        if (err == 'ok') {
          if (isAnnualPlan) {
            // perform Annual plan stuff...
            return;
          }
        } else if (err) {
          console.log("__Error in stripe_webhook >> charge_failed event__");
          return;
        } else {
          console.log("__stripe_webhook >> charge_failed event executed successfully__");
        }
      });
  }

  else if (body.type == "invoice.created") {
    invoiceCreatedWebhook(body);
  }

  else if (body.type == "invoice.payment_succeeded") {
    invoicePaymentSucceeded(body);
  }
  
  response.status(200).send({});
}

router
  .route('/stripe_webhook')
  .post(stripe_webhook);

export default router;

