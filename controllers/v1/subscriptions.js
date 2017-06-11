/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import Moment from 'moment';

import db from '../../models';
import stripe from '../stripe';
import { BadRequestError } from '../errors';

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
          primaryAccountHolderId: req.user.get('id'),
        }, {
          primaryAccountHolderId: req.user.addedBy,
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
function reEnroll(req, res, next) {
  // 1. Check if re-enrolling a family member
  // 1a. Get the family member
  // 2. Get the current subscription + its membership record (validate these exist)
  // 2a. Validate the plan type is year, the subscription is inactive, and the sub has ended via `endAt`
  // 3. Get the plan name from stripe
  // 4. Get the payment profile (validate it exists)
  // 5. Re-Enroll the user again by issuing the charge
  // 6. Update the subscription record to reflect a valid subscription + mark it 100% discount
  // 7. Update the endAt date to be this time next year + update status
  // 8. Update user flag for being charged a reEnrollmentFee to true
  // 9. Success!

  let subscription = {};
  let membership = {};
  let payProfile = {};
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
      if (s.dentistId !== req.params.dentistId) throw new Error('Patient can only re-enroll into an existing plan. To switch, use change plan.');
      const isAlmostExpiring = (Moment().subtract(30, 'days').diff(Moment(s.endAt), 'days') >= 0);
      if ((s.stripeSubscriptionId !== null || s.status === 'expired' || isAlmostExpiring)) throw new Error('User is not qualified to re-enroll or does not have less than 30 days in their current annual plan');
      subscription = s;
      return db.Membership.find({ where: { id: s.membershipId, userId: req.params.dentistId } });
    })
    .then((m) => {
      // 2. Get Membership && validate plan exists
      if (!m) throw new Error('Requested membership plan does not exist for Dentist');
      if (m.type !== 'year') throw new Error('Current membership plan is not an annual plan');
      return stripe.getMembershipPlan(m.stripePlanId);
    })
    .then((m) => {
      // 3. Get plan name from stripe
      membership = m;
      // 4. Get Payment Profile
      return db.PaymentProfile.find({
        $or: [{
          primaryAccountHolderId: req.user.get('id'),
        }, {
          primaryAccountHolderId: req.user.addedBy,
        }],
      });
    })
    .then((pp) => {
      if (!pp) throw new Error('Current user somehow somehow has no active payment profile'); // this should never happen
      payProfile = pp;
      return Promise.resolve();
    })
    .then(() => (
      // 6. Check if this is an annual subscription, if so, charge the full cost, and give 100% off on the subscription
      stripe.issueCharge(membership.amount, payProfile.stripeCustomerId, `Annual Subscription: ${membership.name}`)
    ))
    .then(() => (
      // 100% off the subscription but register it so our hooks can track when it expires
      stripe.createSubscription(membership.name, payProfile.stripeCustomerId, 100)
    ))
    .then((newSubscription) => {
      subscription.stripeSubscriptionId = newSubscription.id;
      subscription.membershipId = req.params.membershipId;
      subscription.endAt = Moment().add(1, 'year');
      subscription.status = 'active';
      return subscription.save();
    })
    .then(() => {
      req.user.reEnrollmentFee = true;
      return req.user.save();
    })
    .then(() => res.json({}))
    .catch(err => next(new BadRequestError(err)))
  ))
  .catch(err => next(new BadRequestError(err)));
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

  // 1. Get the requested user object
  db.User.find({ where: { id: req.params.userId } })
  .then((userObj) => {
    if (!userObj) throw new Error('Requested user does not exist!');
    user = userObj;
    // 2. Get the subscription of the user requested (must check on dentistId too)
    return db.Subscription.find({
      where: {
        clientId: req.params.userId,
        dentistId: req.params.dentistId,
      },
    });
  })
  .then((sub) => {
    if (!sub) throw new Error('User has no subscription object'); // this should never happen (unless the user is a dentist)
    subscription = sub;
    // 3. Block if sub not found or current user is not the clientId in sub (unless the clientId is a family member)
    if (sub.stripeSubscriptionId === null) {
      throw new Error('Current user has no currently existing subscription to switch from or is not a patient type user');
    } else if ((req.user.get('id') === sub.clientId) || // current user owns this subscription
        (req.user.get('id') === sub.dentistId) || // current user is the dentist
        (req.user.get('id') === user.get('addedBy'))) { // current user is the parent of the requested user
      // 4. Get the requested membership plan of the dentist
      return db.Membership.find({ where: { id: req.params.membershipId, userId: req.params.dentistId } });
    } else {
      throw new Error('Current user account does not have access to change the membership plan of the requested user');
    }
  })
  .then((m) => {
    // 5. Get additional membership details from Stripe
    if (!m) throw new Error('Requested membership plan does not exist for Dentist');
    return stripe.getMembershipPlan(m.stripePlanId);
  })
  .then((m) => {
    membership = m;
    // 6. Update the subscription to the new plan (make sure to prorate it)
    return stripe.updateSubscription(subscription.stripeSubscriptionId, membership.name);
  })
  .then(() => {
    subscription.membershipId = req.params.membershipId;
    subscription.status = 'active';
    subscription.save();
  })
  .then(() => res.json({}))
  .catch(err => next(new BadRequestError(err)));
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

  // 1. Get the user requested
  db.User.find({
    where: Object.assign({}, { id: userId }, query),
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
        (req.user.cancellationFeeWaiver === false) &&
        // Check if the user cancelled after the free cancellation period (i.e. 3 months from sign up)
        (Moment(sub.since).add(EARLY_CANCELLATION_TERM, 'month').isAfter(Moment()))) {
      // 5. Get Payment Profile
      return db.PaymentProfile.find({
        $or: [{
          primaryAccountHolderId: currentUserId,
        }, {
          primaryAccountHolderId: user.addedBy,
        }],
      });
    }
    return Promise.resolve(null);
  })
  .then((payProfile) => {
    if (payProfile !== null) {
      // Charge the user for cancelling
      return stripe.issueCharge(EARLY_CANCELLATION_PENALTY, payProfile.stripeCustomerId, 'Early Cancellation Penalty Charge');
    }
    return Promise.resolve();
  })
  // 5. Cancel the user's subscription
  .then(() => stripe.cancelSubscription(subscription.stripeSubscriptionId))
  .then(() => {
    // Turn on Re-Enrollment flag because user should be charged if signing up again
    user.reEnrollmentFee = true;
    return user.save();
  })
  .then(() => {
    // 6. Upon success, update the subscription record
    subscription.status = 'canceled';
    subscription.stripeSubscriptionId = null;
    subscription.membershipId = null;
    return subscription.save();
  })
  .then(() => res.json({}))
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
  .route('/plan/re-enroll')
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

router
  .route('/members/:userId/plan/re-enroll')
  .put(reEnroll);

// ────────────────────────────────────────────────────────────────────────────────
// WAIVERS

router
  .route('/patients/:userId/toggle-cancellation-waiver')
  .put(toggleCancellationFeeWaiver);

export default router;
