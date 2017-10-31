import db from '../models';
import stripe from '../controllers/stripe';

const moment = require('moment');

// Webhook that updates existing plan users if their dentist updated the plan.
// The update should only happen if the new plan is 3 months old.
async function invoiceCreatedWebhook(body) {
  try {
    const stripeCustomerId = body.data.object.customer;

    // 1. Get the payment profile
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        stripeCustomerId
      }
    });

    if (!paymentProfile) {
      throw 'No matching records in payment profile. invoice.created failed.';
    }

    // 2. Get the client Subscriptions
    const clientSubscriptions = await db.Subscription.findAll({
      where: {
        paymentProfileId: paymentProfile.id
      }
    });

    // 3. Get the Dentist's Membership plans.
    const dentistMembershipPlans = await db.Membership.findAll({
      where: {
        userId: clientSubscriptions[0].dentistId
      }
    });

    // 4. Update the subscription's if their respective plans are changed and Its been 3 months.
    const stripeCustomerObject = await stripe.getCustomer(stripeCustomerId);

    for (const subscription of stripeCustomerObject.subscriptions.data) {
      for (const subItem of subscription.items.data) {
        const existingPlan = dentistMembershipPlans.find(p => p.stripePlanId == subItem.plan.id);
        if (existingPlan.active) {
          continue;
        }
        const newPlan = dentistMembershipPlans.find(p => {
          return p.active == true && p.name == existingPlan.name && p.type == existingPlan.type && p.subscription_age_group == existingPlan.subscription_age_group;
        });
        const isThreeMonthsOld = moment().add('1', 'month').isAfter(moment(newPlan.createdAt).add('3','month'));
        if (isThreeMonthsOld || newPlan.type == 'year') {
          await stripe.updateSubscriptionItem(sub.id, { plan: newPlan.stripePlanId });
          await db.Subscription.update({
            membershipId: newPlan.membershipId
          }, {
            where: {
              paymentProfileId: paymentProfile.id,
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionItemId: sub.id,
              membershipId: existingPlan.id
            }
          });
        }
      }
    }
    console.log('invoice.created hook executed successfully');
    return;
  } catch (e) {
    console.log('***************');
    console.log('Error in invoiceCreatedWebhook');
    console.log(e);
    console.log('***************');
  }
}

export default invoiceCreatedWebhook;

