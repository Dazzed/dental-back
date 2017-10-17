/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import Moment from 'moment';

import db from '../../models';
import stripe from '../stripe';
import { BadRequestError } from '../errors';
import { reenrollMember, performEnrollmentWithoutProration } from '../../utils/reenroll';
import { changePlanUtil } from '../../utils/change_plan';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const RE_ENROLLMENT_PENALTY = process.env.RE_ENROLLMENT_PENALTY * 100;

/**
 * Subscribes the current user session (or family member) to a dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function subscribe(req, res, next) {
  let subscription = {};
  let membership = {};
  let payProfile = {};
  let isAnnualSub = false;
  let endTimeInterval = 'months';
  const memberId = req.params.userId || null;

  let preFetch = Promise.resolve();

  // Check if subscribing a family member
  if (memberId) {
    // Get the Family Member
    preFetch = preFetch
      .then(() => (
        db.User.find({
          where: {
            id: memberId,
            addedBy: req.user.get('id'),
          },
        })
      ))
      .then((member) => {
        if (!member) throw new Error('Member does not exist');
        req.user = member;
      });
  }

  preFetch
    .then(() => (
      db.Subscription.find({
        where: { clientId: req.user.get('id') },
      })
        .then((s) => {
          // 1. Get current subscription && validate subscription DNE
          if (!s) throw new Error('User somehow does not have an existing subscription record'); // this should never happen (unless you are a dentist)
          if (s.stripeSubscriptionId !== null) throw new Error('User is already subscribed to a plan');
          subscription = s;
          return db.Membership.find({ where: { id: req.params.membershipId, userId: req.params.dentistId } });
        })
        .then((m) => {
          // 2. Get Membership && validate plan exists
          if (!m) throw new Error('Requested membership plan does not exist for Dentist');
          return stripe.getMembershipPlan(m.stripePlanId);
        })
        .then((m) => {
          // 3. Get plan name from stripe
          membership = m;
          // 4. Get Payment Profile
          return db.PaymentProfile.find({
            $or: [{
              primaryAccountHolder: req.user.get('id'),
            }, {
              primaryAccountHolder: req.user.addedBy,
            }],
          });
        })
        .then((pp) => {
          if (!pp) throw new Error('Current user somehow somehow has no active payment profile'); // this should never happen
          payProfile = pp;
          // 5. Check if user should be charged for re-enrollment
          if ((req.user.reEnrollmentFee === true) && (req.user.reEnrollmentFeeWaiver === false)) {
            // Charge user for re-enrolling
            return stripe.issueCharge(RE_ENROLLMENT_PENALTY, payProfile.stripeCustomerId, 'Re-Enrollment Penalty Charge');
          }
          return Promise.resolve();
        })
        .then(() => {
          // 6. Check if this is an annual subscription, if so, charge the full cost, and give 100% off on the subscription
          if (membership.interval === 'year') {
            isAnnualSub = true;
            endTimeInterval = 'years';
            return stripe.issueCharge(membership.amount, payProfile.stripeCustomerId, `Annual Subscription: ${membership.name}`);
          }
          return Promise.resolve();
        })
        .then(() => {
          if (isAnnualSub) {
            // 100% off the subscription but register it so our hooks can track when it expires
            return stripe.createSubscription(membership.name, payProfile.stripeCustomerId, 100);
          }
          return stripe.createSubscription(membership.name, payProfile.stripeCustomerId);
        })
        .then((newSubscription) => {
          subscription.stripeSubscriptionId = newSubscription.id;
          subscription.membershipId = req.params.membershipId;
          subscription.endAt = Moment().add(1, endTimeInterval);
          subscription.status = 'active';
          return subscription.save();
        })
        .then(() => {
          // Prevent the user from hitting a re-enrollment fee
          req.user.reEnrollmentFee = false;
          return req.user.save();
        })
        .then(() => res.json({}))
        .catch(err => next(new BadRequestError(err)))
    ))
    .catch(err => next(new BadRequestError(err)));
}

/**
 * Helps users who wish to continue their existing plan but the plan has expired
 * ( !!! only provided to annual membership plans !!! )
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
async function reEnroll(req, res) {
  try {
    const memberId = req.params.userId;
    const membershipId = req.query.membershipId;
    const currentUserId = req.user.get('id');

    let user = await db.User.findOne({ where: { id: memberId } });
    if (user.addedBy) {
      user = await db.User.findOne({ where: { id: user.addedBy } });
    }
    const paymentProfile = await db.PaymentProfile.findOne({ where: { primaryAccountHolder: user.id } });
    const accountHolderSubscriptions = await db.Subscription.findAll({
      where: {
        paymentProfileId: paymentProfile.id
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    });
    const membershipPlan = await db.Membership.findOne({ where: { id: membershipId } });
    const userSubscription = await db.Subscription.findOne({ 
      where: {
        clientId: memberId,
        dentistId: membershipPlan.userId
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    });
    const {
      stripeSubscriptionId,
      stripeSubscriptionItemId,
      status
    } = userSubscription;

    // throw an error if the subscription is active
    if (stripeSubscriptionId || stripeSubscriptionItemId || status === 'active') {
      return res.status(400).send({ errors: "User already has an active subscription" });
    }

    const perform = () => {
      return new Promise((resolve, reject) => {
        performEnrollmentWithoutProration(accountHolderSubscriptions, membershipPlan, userSubscription, (err, data) => {
          if (err) {
            return reject(err);
          }
          return resolve(data);
        });
      });
    };

    await perform();
    // Do not fire penality if user is enrolling for the first time.
    // We identify this if the stripeSubscriptionIdUpdatedAt is null.
    const isEnrollingFirstTime = userSubscription.stripeSubscriptionIdUpdatedAt ? false : true;
    if (user.reEnrollmentFeeWaiver == true && !isEnrollingFirstTime) {
      const invoiceItem = await stripe.createInvoiceItem({
        customer: paymentProfile.stripeCustomerId,
        amount: RE_ENROLLMENT_PENALTY,
        currency: 'usd',
        description: 're-enrollment Fee'
      });
      console.log("Invoice item for reenrollOperation success for user Id -> " + paymentProfile.primaryAccountHolder);
      await db.Penality.create({
        clientId: userSubscription.clientId,
        dentistId: userSubscription.dentistId,
        type: 'reenrollment',
        amount: 9900
      });
    }
    const subscription = await db.Subscription.findOne({
      where: {
        id: userSubscription.id
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    });
    return res.status(200).send({ data: subscription });
  } catch(e) {
    console.log(e);
    return res.status(500).send({ message: "Internal Server Error" });
  }
}

/**
 * Changes the user's membership plan with current dentist (dentist is allowed to change this)
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function changePlan(req, res, next) {

  const memberId = req.params.userId;
  const { membershipId } = req.params;
  const { subscriptionId } = req.query;
  const currentUserId = req.user.get('id');

  changePlanUtil(memberId, currentUserId, membershipId, subscriptionId)
    .then(subscription => res.status(200).send({ data: subscription }), err => res.status(500).send(err));
}

/**
 * Gets details about the user's subscription
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getSubscription(req, res, next) {
  const userId = req.params.userId || req.user.get('id');
  const currentUserId = req.user.get('id');
  let query = {};
  let user = {};
  let subscription = {};

  // Limit the query to allow fetching only related members
  // of the primary user when providing a user id
  if (req.params.userId && req.user.get('type') !== 'dentist') {
    // allow dentists to be excused
    query = {
      addedBy: currentUserId,
    };
  }

  db.User.find({
    where: Object.assign({}, { id: userId }, query),
  })
    .then((userObj) => {
      if (!userObj) throw new Error('No user was found!');
      user = userObj;
      return db.Subscription.getCurrentSubscription(user.get('id'));
    })
    .then((sub) => {
      if (sub.status === 'canceled') throw new Error('User does not have an active subscription');
      subscription = sub;
      return user.getMySubscription();
    })
    .then((sub) => {
      if (!sub) throw new Error('User has no related subscription!'); // this should not happen (unless a dentist)
      // Validate current user is either primary or dentist
      if (currentUserId === subscription.clientId ||
        currentUserId === user.addedBy ||
        currentUserId === subscription.dentistId) {
        return res.json({ data: sub });
      }
      throw new Error('Current user is not allowed to see this persons subscription!');
    })
    .catch(err => next(new BadRequestError(err)));
}

/**
 * Cancels the user's subscription with the dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */

async function cancelSubscription(req, res) {
  try {
    const userId = req.params.userId || req.user.get('id');
    const currentUserId = req.user.get('id');

    if (!userId || !currentUserId) {
      throw 'Missing parameters';
    }

    // 1. Get the user requested.
    const user = await db.User.find({ where: { id: userId } });


    const subscription = await db.Subscription.getCurrentSubscription(user.id);


    if ((currentUserId !== subscription.clientId &&
      currentUserId !== user.addedBy &&
      currentUserId !== subscription.dentistId)) {
      throw new Error('Current user is not allowed to see this persons subscription!');
    }

    if (subscription.status === 'canceled' || subscription.status === 'cancellation_requested') {
      throw `Subscription status is ${subscription.status}`;
    }

    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: user.addedBy || user.id,
      }
    });

    let primaryUser;
    if (user.addedBy) {
      primaryUser = await db.User.findOne({ where: { id: user.addedBy } });
    } else {
      primaryUser = user;
    }

    const stripeSubscription = await stripe.getSubscription(subscription.stripeSubscriptionId);

    const membershipPlan = await db.Membership.findOne({
      where: {
        id: subscription.membershipId
      }
    });

    const quantity = stripeSubscription.items.data.reduce((acc, item) => acc += item.quantity, 0);
    let query;
    if (quantity == 1) {
      await stripe.deleteSubscription(stripeSubscription.id);
    } else {
      const subscriptionItem = stripeSubscription.items.data.find(s => s.plan.id == membershipPlan.stripePlanId);
      const subItemQuantity = subscriptionItem.quantity;
      if (subItemQuantity > 1) {
        await stripe.updateSubscriptionItem(subscriptionItem.id, {
          quantity: subscriptionItem.quantity - 1,
          prorate: false
        });
      } else {
        await stripe.deleteSubscriptionItem(subscriptionItem.id, { prorate: false });
      }
    }

    subscription.status = 'cancellation_requested';
    subscription.cancelsAt = Moment.unix(stripeSubscription.current_period_end);

    await subscription.save();

    return res.status(200).send(subscription);

  } catch (e) {
    console.log("Error in cancelSubscription, ", e);
    return res.status(400).send({ error: e });
  }

}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

// NOTE: (Endpoints Available only to primary family user or assigned dentist)

const router = new Router({ mergeParams: true });

router
  .route('/plan/:membershipId')
  .post(subscribe);

router
  .route('/plan/:membershipId/user/:userId')
  .put(changePlan);

router
  .route('/plan/:userId/re-enroll')
  .put(reEnroll);

// Manage subscriptions for members of a family

router
  .route('/members/:userId/plan/:membershipId')
  .post(subscribe)
  .put(changePlan);

router
  .route('/members/:userId/plan')
  .get(getSubscription)
  .delete(cancelSubscription);

// router
//   .route('/members/:userId/plan/re-enroll')
//   .put(reEnroll);

// ────────────────────────────────────────────────────────────────────────────────
// WAIVERS

export default router;