import _ from 'lodash';

import db from '../models';
import { subscriptionChargeFailedNotification } from '../controllers/sendgrid_mailer';

// check for 1-4 failed attempts and change the status of the subscription accordingly.
// Send the respective subscription failed email to the patient depending on the attempt count.
export default async function invoicePaymentFailedWebhook(body) {
  try {
    const {
      data: {
        object: webhookObject
      }
    } = body;
    // 1. Extract type of subscription
    const {
      customer: stripeCustomerId,
    } = webhookObject;

    const isAnnualSubscription = webhookObject.lines.data
      .some(lineData => lineData.plan.interval === 'year');

    // Do not initate any action if the membership type is year.
    if (isAnnualSubscription) {
      return;
    }

    let stripeSubscriptionId = _.uniq(
      webhookObject.lines.data
        .map(lineData => lineData.id)
    );

    if (stripeSubscriptionId.length === 1) {
      stripeSubscriptionId = stripeSubscriptionId[0];
    }

    // 2. Perform local subscription model actions.
    const { attempt_count } = webhookObject;
    let status;
    let updateObject = {};
    if (attempt_count === 1) {
      status = 'past_due';
      updateObject = {
        status
      };
    } else if (attempt_count === 4) {
      status = 'inactive';
      updateObject = {
        status,
        stripeSubscriptionId: null,
        stripeSubscriptionItemId: null,
        membershipId: null,
      };
    }
    if (Object.keys(updateObject).length > 0) {
      await db.Subscription.update(updateObject, {
        where: {
          stripeSubscriptionId
        }
      });
    }
    // 3. Send the email to the patient regarding the attempt count and status.
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        stripeCustomerId
      }
    });

    if (!paymentProfile) {
      throw 'Payment Profile not found';
    }

    const patient = await db.User.findOne({
      where: {
        id: paymentProfile.primaryAccountHolder
      }
    });

    const patientSubscription = await db.Subscription.findOne({
      where: {
        stripeSubscriptionId
      }
    });

    const dentistInfo = await db.DentistInfo.findOne({
      where: {
        userId: patientSubscription.dentistId
      }
    });

    const officeName = dentistInfo.officeName.replace(/ /g, '');

    if (!patient) {
      throw 'Patient not found';
    }

    subscriptionChargeFailedNotification(patient, attempt_count, officeName);
  } catch (e) {
    console.log('**************************************');
    console.info('Error in invoicePaymentFailedWebhook');
    console.log(e);
    console.log('**************************************');
  }
}
