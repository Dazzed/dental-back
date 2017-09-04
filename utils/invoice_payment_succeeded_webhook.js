import db from '../models';

// Handler for stripe  invoice.payment_succeeded webhook
export default async function (body) {
  try {
    body = body.data.object;
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        stripeCustomerId: body.customer
      }
    });
    const anySubscription = await db.Subscription.findOne({
      where: {
        paymentProfileId: paymentProfile.id
      }
    });

    for (let item of body.lines.data) {
      const subscriptions = await db.Subscription.findAll({
        where: {
          stripeSubscriptionId: item.id,
          stripeSubscriptionItemId: item.subscription_item,
        }
      });
      for (let sub of subscriptions) {
        await db.Payment.create({
          clientId: sub.clientId,
          dentistId: sub.dentistId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          amount: item.amount / item.quantity
        });
      }
    }
  } catch(e) {
    console.log("Error in invoice payment_succeeded webhook");
    console.log(e);
  }
}
