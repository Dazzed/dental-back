import db from '../models';
import moment from 'moment';
import { subscriptionCancellationNotification } from '../controllers/sendgrid_mailer';
import stripe from '../controllers/stripe';

const asynchronous = require('async');

export async function subscriptionCancellationJob() {
  try {
    const targetedRecords = await db.Subscription.findAll({
      where: {
        cancelsAt: {
          $lte: moment()
        }
      }
    });
    
    console.log(targetedRecords)

    if (!targetedRecords.length) {
      return;
    }

    const cancellationOperation = () => {
      return new Promise((resolve, reject) => {
        asynchronous.each(targetedRecords, (subscription, callback) => {
          stripe.getSubscription(subscription.stripeSubscriptionId)
            .then(stripeSubscription => {
              db.Membership.findOne({
                where: {
                  id: subscription.membershipId
                }
              }).then(membership => {
                const quantity = stripeSubscription.items.data.reduce((acc, item) => acc += item.quantity, 0);
                let query;
                if (quantity == 1) {
                  query = stripe.deleteSubscription(stripeSubscription.id);
                } else {
                  const subscriptionItem = stripeSubscription.items.data.find(s => s.plan.id == membership.stripePlanId);
                  query = stripe.updateSubscriptionItem(subscriptionItem.id, {
                    quantity: subscriptionItem.quantity - 1
                  });
                }
                query.then(d => {
                  subscription.status = 'canceled';
                  subscription.stripeSubscriptionId = null;
                  subscription.stripeSubscriptionItemId = null;
                  subscription.cancelsAt = null;
                  subscription.save();
                }, e => callback(e));
              }, e => callback(e));
            }, e => callback(e));
        }, (err) => {
          if (err) {
            return reject(err);
          }
          return resolve(true);
        });
      });
    };

    const operationStatus = await cancellationOperation();
    return operationStatus;
  } catch (e) {
    throw e;
  }
}
