import { Router } from 'express';
import { subscriptionChargeFailedNotification } from '../sendgrid_mailer';
var moment = require('moment');
import db from '../../models';

import stripe from '../stripe';
var async = require('async');

const router = new Router({ mergeParams: true });

function waterfaller(functions) {
  return new Promise((resolve, reject) => {
    async.waterfall(
      functions,
      (err, data) => {
        if (err && err !== 'ok') {
          console.log("ERROR in waterfaller");
          console.log(err);
          return reject(err);
        }  else {
          return resolve(data);
        }
      }
    );
  });
}

function stripe_webhook(request, response) {

  var { body } = request;
  console.log(`webhook event: ${body.type}`);

  // update cached data on invoice changes
  if (body.type.startsWith('invoice')) {
    const stripeCustomerId = body.data.object.customer;
    const invoiceYear = moment.unix(body.data.object.date).year().toString();
    console.log(`updating cached invoice response for customer ${stripeCustomerId}, year ${invoiceYear}`);
    stripe.getInvoices(stripeCustomerId, invoiceYear, true); // force cache update for affected cached year in invoices
  } else if (body.type.startsWith('charge')) {
    const stripeCustomerId = body.data.object.customer;
    const chargeYear = moment.unix(body.data.object.created).year().toString();
    console.log(`updating cached charge response for customer ${stripeCustomerId}, year ${chargeYear}`);

    stripe.getCharges(stripeCustomerId, chargeYear, true); // force cache update for affected cached year in charges

  }

  if (body.type === 'charge.succeeded') {
    function queryPaymentProfile(callback) {
      let stripeCustomerId = body.data.object.customer;
      db.PaymentProfile.findOne({
        where: {
          stripeCustomerId
        }
      }).then(paymentProfile => {
        if (!paymentProfile) {
          return callback('No matching records in payment profile');
        }
        let paymentProfileId = paymentProfile.id;
        callback(null, paymentProfileId);
      });
    }

    function getClientSubscriptions(paymentProfileId, callback) {
      db.Subscription.findAll({
        where: {
          paymentProfileId
        }
      }).then(clientSubscriptions => {
        callback(null, clientSubscriptions);
      })
    }

    function getDentistMembershipPlans(clientSubscriptions, callback) {
      if (clientSubscriptions.length > 0) {
        let { dentistId } = clientSubscriptions[0];
        db.Membership.findAll({
          where: {
            userId: dentistId
          }
        }).then(dentistMembershipPlans => {
          callback(null, clientSubscriptions, dentistMembershipPlans);
        })
      }
      else {
        callback(null, [], []);
      }
    }

    function checkAdultUsers(clientSubscriptions = [], dentistMembershipPlans = [], callback) {
      let thirteen_years_ago = moment().subtract("13", "years").add("1", "month").format("YYYY-MM-DD");
      let clientIds = clientSubscriptions.map(subscription => subscription.clientId);
      if (clientIds.length > 0) {
        db.User.findAll({
          where: {
            id: {
              $in: clientIds
            },
            birthDate: {
              $lte: thirteen_years_ago
            }
          }
        }).then(clients => {
          let matchingClientIds = clients.map(client => client.id);
          clientSubscriptions = clientSubscriptions.filter(sub => matchingClientIds.includes(sub.clientId));
          callback(null, clientSubscriptions, dentistMembershipPlans);
        });
      }
      else {
        callback(null, clientSubscriptions, dentistMembershipPlans)
      }
    }

    function checkAndUpdateChildMembershipPlans(clientSubscriptions = [], dentistMembershipPlans = [], callback) {

      if (clientSubscriptions.length > 0 && dentistMembershipPlans.length > 0) {
        async.each(clientSubscriptions, (subs, eachCallback) => {
          let clientPlan = dentistMembershipPlans.find(plan => plan.id == subs.membershipId);
          let dentistChildMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default child membership' && plan.type == "month");
          let dentistAdultMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default membership' && plan.type == "month");
          if (clientPlan.name !== 'default membership' && clientPlan.type == "month" && (subs.status == "active" || subs.status == "past_due")) {
            stripe.updateSubscription(subs.stripeSubscriptionId, dentistAdultMemberShip.stripePlanId, true)
              .then(data => {
                subs.membershipId = dentistAdultMemberShip.id;
                if (subs.status == "past_due") {
                  subs.status = "active";
                }
                subs.save();
                eachCallback();
              }, (err) => {
                eachCallback(err);
              });
          }
          else {
            eachCallback();
          }
        }, (err) => {
          if (err) {
            callback(err);
          }
          else {
            callback(null, "charge_succeeded hook executed Successfully.");
          }
        });
      }
      else {
        callback(null, "charge_succeeded hook executed Successfully with NO changes.");
      }
    }

    async.waterfall([
      queryPaymentProfile,
      getClientSubscriptions,
      getDentistMembershipPlans,
      checkAdultUsers,
      checkAndUpdateChildMembershipPlans
    ], (err, result) => {
      if (err) {
        console.log(err);
      } else {
        console.log(result);
      }
    });
  }

  else if (body.type == "charge.failed") {
    const invoiceId = body.data.object.invoice;
    const customerId = body.data.object.customer;

    function pluckIntervaltype(callback) {
      stripe.getInvoice(invoiceId).then(invoice => {
        const isMonthlyPlan = invoice.lines.data.some(line => line.plan.interval === 'month');
        const isAnnualPlan = invoice.lines.data.some(line => line.plan.interval === 'year');
        const stripeSubscriptionId = invoice.subscription;
        const attempt_count = invoice.attempt_count;
        // if (isAnnualPlan) {
        //   return callback('ok', isAnnualPlan, { stripeSubscriptionId });
        // }
        return callback(null, attempt_count, stripeSubscriptionId);
      }, err => {
        return callback(err);
      })
    }

    function performLocalActions(attempt_count, stripeSubscriptionId, callback) {
      let status;
      let updateObject = {};
      if (attempt_count === 1) {
        status = 'late';
        updateObject = {
          status
        };
      } else if (attempt_count === 4) {
        status = 'canceled';
        updateObject = {
          status,
          stripeSubscriptionId: null,
          stripeSubscriptionItemId: null,
          membershipId: null,
        };
      }
      if (Object.keys(updateObject).length > 0) {
        db.Subscription.update(updateObject,
          {
            where: {
              stripeSubscriptionId
            }
          }).then(subscriptions => {
            return callback(null, attempt_count);
          }, err => callback(err));
      } else {
        return callback(null, attempt_count);
      }
    }

    function sendMailToCustomer(attempt_count, callback) {
      db.PaymentProfile.findOne({
        where: stripeCustomerId
      })
        .then(profile => {
          db.User.findOne({
            where: {
              id: profile.primaryAccountHolder
            }
          }).then(user => {
            subscriptionChargeFailedNotification(user, attempt_count);
            callback(null, true);
          }, err => callback(err));
        }, err => callback(err));

    }

    async.waterfall(
      [
        pluckIntervaltype,
        performLocalActions,
        sendMailToCustomer
      ]
      , (err, isAnnualPlan, data) => {
        if (err == 'ok') {
          if (isAnnualPlan) {
            // perform Annual plan stuff...
            return;
          }
        } else if (err) {
          console.log("__Error in stripe_webhook >> charge_failed event__");
          return;
        } else {
          console.log("__stripe_webhook >> charge_failed event executed successfully__");
        }
      });
  }

  else if (body.type == "invoice.created") {
    const stripeCustomerId = body.data.object.customer;

    function queryPaymentProfile(callback) {
      db.PaymentProfile.findOne({
        where: {
          stripeCustomerId
        }
      }).then(paymentProfile => {
        if (!paymentProfile) {
          return callback('No matching records in payment profile. invoice.created failed.');
        }
        let paymentProfileId = paymentProfile.id;
        callback(null, paymentProfileId);
      });
    }

    function getClientSubscriptions(paymentProfileId, callback) {
      db.Subscription.findAll({
        where: {
          paymentProfileId
        }
      }).then(clientSubscriptions => {
        callback(null, clientSubscriptions);
      })
    }

    function getDentistMembershipPlans(clientSubscriptions, callback) {
      if (clientSubscriptions.length > 0) {
        const { dentistId } = clientSubscriptions[0];
        db.Membership.findAll({
          where: {
            userId: dentistId
          }
        }).then(dentistMembershipPlans => {
          callback(null, clientSubscriptions, dentistMembershipPlans);
        });
      } else {
        callback(null, [], []);
      }
    }
    
    function updateObsoleteSubscriptionItems(clientSubscriptions, dentistMembershipPlans, callback) {
      stripe.getCustomer(stripeCustomerId).then(stripeCustomerObject => {
        async.each(stripeCustomerObject.subscriptions.data, (subscription, eachiCallback) => {
          async.each(subscription.items.data, (sub, eachjCallback) => {
            const existingPlan = dentistMembershipPlans.find(p => p.stripePlanId == sub.plan.id);
            if (existingPlan.active) {
              return eachjCallback();
            }
            const newPlan = dentistMembershipPlans.find(p => {
              return p.active == true && p.name == existingPlan.name && p.type == existingPlan.type && p.subscription_age_group == existingPlan.subscription_age_group;
            });
            const isThreeMonthsOld = moment().add('1', 'month').isAfter(moment(newPlan.createdAt).add('3','month'));
            if (isThreeMonthsOld || newPlan.type == 'year') {
              stripe.updateSubscriptionItem(sub.id, { plan: newPlan.stripePlanId })
                .then(() => {
                  db.Subscription.update({
                    membershipId: newPlan.membershipId
                  }, {
                    where: {
                      paymentProfileId: clientSubscriptions[0].paymentProfileId,
                      stripeSubscriptionId: subscription.id,
                      stripeSubscriptionItemId: sub.id,
                      membershipId: existingPlan.id
                    }
                  }).then(updatedSub => eachjCallback(), err => eachjCallback(err));
                }, err => eachjCallback(err));
            } else {
              eachjCallback();
            }
          }, function eachjCallback(err) {
            if (!err) {
              eachiCallback();
            } else {
              eachiCallback(err);
            }
          })
        }, function eachiCallback(err,data) {
          callback();
        });
      }, err => callback(err));
    }
    
    waterfaller(
      [
        queryPaymentProfile,
        getClientSubscriptions,
        getDentistMembershipPlans,
        updateObsoleteSubscriptionItems
      ]
    ).then(data => console.log("invoice.created hook executed successfully"), err => console.log(err));
  }
  response.status(200).send({});
}

router
  .route('/stripe_webhook')
  .post(stripe_webhook);

export default router;

