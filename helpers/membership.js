import db from '../models';
import {
  membershipPriceChangeNotificationAdvance
} from '../controllers/sendgrid_mailer';

// Notify existing plan users about the change..
async function notifyPlanUpdate(membershipId, planName, newPrice) {
  try {
    const subscriptions = await db.Subscription.findAll({
      where: {
        id: membershipId
      }
    });
    // Remove duplicates when plucking the paymentProfile id's..
    const paymentProfileIds = Array.from(new Set(subscriptions.map(s => s.paymentProfileId)));
    if (paymentProfileIds.length) {
      const users = await db.User.findAll({
        where: {
          id: paymentProfileIds
        }
      }).map(u => u.toJSON());
      users.forEach((user) => {
        membershipPriceChangeNotificationAdvance(user, planName, newPrice);
      });
    }
  } catch (e) {
    console.log('Error in notifyPlanUpdate');
    console.log(e);
  }
}

export { notifyPlanUpdate };
