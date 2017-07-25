/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import Moment from 'moment';

import db from '../../models';
import stripe from '../stripe';
import { BadRequestError } from '../errors';
import { reenrollMember } from '../../utils/reenroll';
import { changePlanUtil } from '../../utils/change_plan';
// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const EARLY_CANCELLATION_TERM = process.env.EARLY_CANCELLATION_TERM;

const RE_ENROLLMENT_PENALTY = process.env.RE_ENROLLMENT_PENALTY * 100;
const EARLY_CANCELLATION_PENALTY = process.env.EARLY_CANCELLATION_PENALTY * 100;

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
function reEnroll(req, res) {
  const memberId = req.params.userId;
  const membershipId = req.query.membershipId;
  const currentUserId = req.user.get('id');

  reenrollMember(memberId, currentUserId, membershipId).then(data => {
    res.status(200).send({});
  }, err => {
    res.status(500).send(err);
  });
}

/**
 * Changes the user's membership plan with current dentist (dentist is allowed to change this)
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function changePlan(req, res, next) {
  let user = {};
  let subscription = {};
  let membership = {};

  const memberId = req.params.userId;
  const { membershipId, subscriptionId } = req.query;
  const currentUserId = req.user.get('id');

  changePlanUtil(memberId, currentUserId, membershipId, subscriptionId)
    .then(data => res.status(200).send({}), err => res.status(500).send(err));
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
function cancelSubscription(req, res, next) {
  const userId = req.params.userId || req.user.get('id');
  const currentUserId = req.user.get('id');
  // let query = {};
  let user = {};
  let subscription = {};
  let membership = {};

  // Limit the query to allow fetching only related members
  // of the primary user when providing a user id
  // if (req.params.userId && req.user.get('type') !== 'dentist') {
  //   // allow dentists to be excused
  //   query = {
  //     addedBy: currentUserId,
  //   };
  // }

  // 1. Get the user requested
  db.User.find({
    where: { id: userId },
  })
    .then((userObj) => {
      // 2. Get the user's subscription
      if (!userObj) throw new Error('No user was found!');
      user = userObj;
      return db.Subscription.getCurrentSubscription(user.id);
    })
    .then((sub) => {
      subscription = sub;
      if (subscription.status === 'canceled') throw new Error('Subscription has already been cancelled!');
      // 3. Check if the current user has the required access
      if ((currentUserId === subscription.clientId ||
        currentUserId === user.addedBy ||
        currentUserId === subscription.dentistId)) {
        return user.getMySubscription();
      }
      throw new Error('Current user is not allowed to see this persons subscription!');
    })
    .then((sub) => {
      if (!sub) throw new Error('User has no related subscription!'); // this should not happen (unless a dentist)
      // 4. Check if a cancellation fee should be applied and/or waived
      if ((req.user.cancellationFee === true) &&
        (req.user.cancellationFeeWaiver === true) &&
        // Check if the user cancelled after the free cancellation period (i.e. 3 months from sign up)
        (Moment().isAfter(Moment(subscription.createdAt).add(EARLY_CANCELLATION_TERM, 'month')))
      ) {
        // 5. Get Payment Profile
        return db.PaymentProfile.findOne({
          where: {
            primaryAccountHolder: user.addedBy,
          }
        });
      }
      return Promise.resolve(null);
    })
    .then((payProfile) => {
      if (payProfile !== null) {
        // Charge the user for cancelling
        return stripe.createInvoiceItem({
          customer: payProfile.stripeCustomerId,
          amount: EARLY_CANCELLATION_PENALTY,
          currency: 'usd',
          description: 'cancellation Fee'
        });
        // return stripe.issueCharge(EARLY_CANCELLATION_PENALTY, payProfile.stripeCustomerId, 'Early Cancellation Penalty Charge');
      }
      return Promise.resolve();
    })
    // 5. Cancel the user's subscription
    .then(() => {
      return db.Membership.findOne({ where: { id: subscription.membershipId } });
      // return stripe.cancelSubscription(subscription.stripeSubscriptionId);
    })
    .then((mem) => {
      membership = mem;
      return stripe.getSubscription(subscription.stripeSubscriptionId);
    })
    .then((stripeSubscription) => {
      console.log(stripeSubscription);
      let quantity = stripeSubscription.items.data.reduce((acc, item) => acc += item.quantity, 0);
      if (quantity == 1) {
        return stripe.deleteSubscription(stripeSubscription.id);
      } else {
        const subscriptionItem = stripeSubscription.items.data.find(s => s.plan.id == membership.stripePlanId);
        return stripe.updateSubscriptionItem(subscriptionItem.id, {
          quantity: subscriptionItem.quantity - 1
        });
      }
    })
    .then(() => {
      // 6. Upon success, update the subscription record
      subscription.status = 'canceled';
      subscription.stripeSubscriptionId = null;
      subscription.stripeSubscriptionItemId = null;
      // subscription.stripeSubscriptionId = null;
      subscription.membershipId = null;
      return subscription.save();
    })
    .then(() => res.send({ user }))
    .catch(err => next(new BadRequestError(err)));
}

/**
 * Waives the cancellation fee. Can only be triggered by the dentist
 * who is providing the patient/member with the subscription
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function toggleCancellationFeeWaiver(req, res, next) {
  if (req.user.get('type') !== 'dentist') throw new Error('Only a dentist can issue a waive cancellation');
  // Get the requested user's subscription
  db.Subscription.getCurrentSubscription(req.params.userId)
    .then((sub) => {
      if (sub.dentistId !== req.user.get('id')) throw new Error('Current user is not the dentist for this user');
      if (sub.status === 'canceled') throw new Error('The user does not have a registered subscription');
      return db.User.find({ where: { id: req.params.userId } });
    })
    .then((user) => {
      user.cancellationFeeWaiver = !user.cancellationFeeWaiver;
      user.save();
    })
    .then(() => res.json({}))
    .catch(err => next(new BadRequestError(err)));
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
  .route('/plan')
  .get(getSubscription)
  .delete(cancelSubscription);

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

router
  .route('/patients/:userId/toggle-cancellation-waiver')
  .put(toggleCancellationFeeWaiver);

export default router;