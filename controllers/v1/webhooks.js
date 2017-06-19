import { Router } from 'express';
var moment = require('moment');
import db from '../../models';

import stripe from '../stripe';

const router = new Router({ mergeParams: true });

function errorCallback(err) {
  console.log("Error in charge_succeeded function.");
  console.log(err);
  return;
}

function charge_succeeded(request, response) {
  let thirteen_years_ago = moment().subtract("13", "years").format("YYYY-MM-DD");
  let { body } = request;
  let stripeSubscriptionId = body.data.object.customer;
  if (body.type === 'charge.succeeded') {
    db.Subscription.findOne({
      stripeSubscriptionId
    }).then(subscription => {
      let { clientId, dentistId } = subscription;
      db.User.findOne({
        where: {
          id: clientId,
          birthDate: {
            $lte: thirteen_years_ago
          }
        }
      }).then(user => {
        if (!user) {
          return;
        }
        else {
          db.Membership.findAll({ userId: dentistId })
            .then(memberships => {
              let activeUserMembership = memberships.find(m => m.id == subscription.membershipId);
              if (activeUserMembership.name == "default child membership") {
                let adultUserMembership = memberships.find(m => m.id !== activeUserMembership.id);
                stripe.updateSubscription(stripeSubscriptionId, adultUserMembership.stripePlanId, true)
                  .then(data => {
                    subscription.membershipId = adultUserMembership.id;
                    subscription.save();
                    return;
                  }, errorCallback);
              }
              else {
                return;
              }
            });
        }
      });
    });
  }
  response.status(200).send({});
}

router
  .route('/charge_succeeded')
  .post(charge_succeeded);

export default router;  
