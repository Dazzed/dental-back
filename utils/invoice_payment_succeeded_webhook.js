/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-loop-func */
import db from '../models';

// Handler for stripe  invoice.payment_succeeded webhook
export default async function (body) {
  try {
    body = body.data.object;
    for (const item of body.lines.data) {
      const subscriptions = await db.Subscription.findAll({
        where: {
          stripeSubscriptionId: item.id,
          stripeSubscriptionItemId: item.subscription_item,
        }
      });
      for (const sub of subscriptions) {
        await db.Payment.create({
          clientId: sub.clientId,
          dentistId: sub.dentistId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          amount: item.amount / item.quantity
        });
      }
      const isLateSubscription = subscriptions
        .some(sub => sub.status === 'past_due');
      if (isLateSubscription) {
        await db.Subscription.update(
          { status: 'active' },
          {
            where: {
              stripeSubscriptionId: item.id
            }
          }
        );
      }
    }
  } catch (e) {
    console.log('Error in invoice payment_succeeded webhook');
    console.log(e);
  }
}
