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
    const dentistInfo = await db.DentistInfo.findOne({
      where: {
        userId: targetedRecords[0].dentistId
      }
    });
    const { officeName } = dentistInfo;
    for (const subscription of targetedRecords) {
      subscription.status = 'canceled';
      subscription.stripeSubscriptionId = null;
      subscription.stripeSubscriptionItemId = null;
      subscription.cancelsAt = null;
      await subscription.save();
      const user = await db.User.findOne({
        where: {
          id: subscription.paymentProfileId
        }
      });
      subscriptionCancellationNotification(user, officeName.replace(/ /g, ''));
    }
    return true;
  } catch (e) {
    console.log(e);
    throw e;
  }
}
