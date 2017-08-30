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

    if (!targetedRecords.length) {
      return;
    }

    const cancellationOperation = () => {
      return new Promise((resolve, reject) => {
        asynchronous.each(targetedRecords, (subscription, callback) => {
          subscription.status = 'canceled';
          subscription.stripeSubscriptionId = null;
          subscription.stripeSubscriptionItemId = null;
          subscription.cancelsAt = null;
          subscription.save().then(() => {
            callback();
          });
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
    console.log(e);
    throw e;
  }
}
