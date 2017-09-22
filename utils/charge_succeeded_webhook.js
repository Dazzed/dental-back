import db from '../models';
import { changePlanUtil } from './change_plan';

const moment = require('moment');

// Watches for adult turned clients using child membership plans
// and updates their respective plan to adult...
export default async function (body) {
  try {
    body = body.data.object;

    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        stripeCustomerId: body.customer
      }
    });

    let clientSubscriptions = await db.Subscription.findAll({
      where: {
        paymentProfileId: paymentProfile.id
      },
      include: [{
        model: db.Membership,
        as: 'membership'
      }]
    });
    
    const { dentistId } = clientSubscriptions[0];
    const dentistMembershipPlans = await db.Membership.findAll({
      where: {
        userId: dentistId
      }
    });

    const thirteen_years_ago = moment().subtract("13", "years").add("1", "month").format("YYYY-MM-DD");
    const clientIds = clientSubscriptions.map(subscription => subscription.clientId);

    if (clientIds.length > 0) {
      const childUsers = await db.User.findAll({
        where: {
          id: {
            $in: clientIds
          },
          birthDate: {
            $lte: thirteen_years_ago
          }
        }
      });
      const matchingClientIds = childUsers.map(client => client.id);
      clientSubscriptions = clientSubscriptions.filter(sub => matchingClientIds.includes(sub.clientId));
      if (clientSubscriptions.length > 0) {
        for (const subscription of clientSubscriptions) {
          const clientPlan = dentistMembershipPlans.find(plan => plan.id == subscription.membershipId);
          const dentistAdultMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default membership' && plan.type == "month");
          if ( clientPlan.name.toLowerCase().includes('child') &&
               clientPlan.type == "month" &&
               (subscription.status == "active" || subscription.status == "past_due")
             ) 
          {
            await changePlanUtil(subscription.clientId, dentistId, dentistAdultMemberShip.id, subscription.id);
            console.log(`USER ID: ${subscription.clientId} was Successfully updated to adult plan`);
          }
        }
        console.log("invoice_created webhook executed Successfully");
        return;
      } else {
        console.log("NO CHANGE (No child users found)");
        console.log("invoice_created webhook executed Successfully");
        return;
      }
    } else {
      console.log("NO CHANGE 2");
      console.log("invoice_created webhook executed Successfully");
      return;
    }


  } catch (e) {
    console.log("Error in invoice_created webhook");
    console.log(e);
  }
}
