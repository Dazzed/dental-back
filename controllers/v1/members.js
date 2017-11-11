/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable operator-assignment */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';
import HTTPStatus from 'http-status';
import moment from 'moment';
import isPlainObject from 'is-plain-object';

import db from '../../models';
import { checkUserDentistPermission } from '../../utils/permissions';

import {
  MEMBER,
  ADD_MEMBER,
} from '../../utils/schema-validators';

import {
  BadRequestError,
} from '../errors';

import {
  userRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

import {
  subscribeNewMember,
} from '../../utils/subscribe';

import {
  getTransferringMember,
  getDeletedEmailFormat
} from '../../helpers/members';

import stripe from '../stripe';

const RE_ENROLLMENT_PENALTY = process.env.RE_ENROLLMENT_PENALTY * 100;
// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of member records
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getMembers(req, res, next) {
  let query;

  // Returns all clients grouped by main user.
  if (req.user.get('type') === 'dentist') {
    query = req.user.getClients();
  } else {
    query = req.user.getMyMembers();
  }

  query
  .then(data => {
    const stripe_public_key = process.env.STRIPE_PUBLIC_KEY;
    return res.json({
      data: data.users,
      recurring_payment_date: data.recurring_payment_date,
      stripe_public_key
    });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Adds a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
async function addMember(req, res, next) {
  let {
    member,
    parentMember
  } = req.body;
  const dentistId = member.dentistId;
  const response = await db.User.addAdditionalMember(member, dentistId, parentMember);

  member = { ...member, id: response.id };
  const parentMemberId = parentMember.client ? parentMember.client.id : parentMember.id;

  try {
    const subscriptionProcess = await subscribeNewMember(parentMemberId, member, response.subscription);
    const sub = await db.Subscription.find({
      where: { clientId: response.id },
      include: [{
        model: db.Membership,
        as: 'membership'
      }]
    });
    const newMemberInfo = response;
    newMemberInfo.clientSubscription = sub.toJSON();
    newMemberInfo.membershipId = newMemberInfo.clientSubscription.membershipId;
    newMemberInfo.clientSubscription.status = 'active';
    delete newMemberInfo.subscription;
    res.status(HTTPStatus.CREATED);
    res.json({ data: newMemberInfo });
  } catch (errors) {
    console.log('GOT ERRORS in addMember action');
    console.log(errors);
    if (isPlainObject(errors)) {
      next(new BadRequestError(errors));
    }
    next(errors);
  }
}

/**
 * Gets a specific member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getMember(req, res, next) {
  const subscription = req.locals.member.subscription;
  const membershipId = subscription ? subscription.membershipId : 0;

  db.Membership.find({
    where: { id: membershipId }
  })
  .then((membership) => {
    if (membership) req.locals.member.membership = membership;
    return res.json({ data: req.locals.member });
  })
  .catch(error => next(error));
}

/**
 * Updates a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
async function updateMember(req, res, next) {
  const data = _.pick(req.body, ['firstName', 'lastName', 'birthDate', 'email',
    'familyRelationship', 'sex', 'city', 'state', 'zipCode', 'contactMethod']);

  let userId = req.params.memberId;
  let addedBy = req.params.userId;

  if (userId === 'me') {
    userId = req.user.get('id');
  }

  if (addedBy === userId) {
    addedBy = null;
  }

  // FIXME: user update does not use a transaction

  // Fetch the user record to update
  await db.User.update(data, {
    where: { id: userId, addedBy },
  });

  if (req.body.address) {
    await db.Address.update({ value: req.body.address }, {
      where: { userId: userId },
    });
    Object.assign(req.locals.member, req.body);
  }

  if (req.body.clientSubscription && req.body.clientSubscription.membershipId) {
    await db.Subscription.update({ membershipId: req.body.clientSubscription.membershipId }, {
      where: { clientId: userId },
    });
    Object.assign(req.locals.member, req.body);
  }

  // Update the phone number
  if (req.body.phone) {
    await db.Phone.update({ number: req.body.phone }, {
      where: { userId: userId },
    });
    Object.assign(req.locals.member, req.body);
  }

  res.json({success:true});
}

/**
 * Deletes a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function deleteMember(req, res, next) {
  const delEmail = `DELETED_${req.locals.member.email}`;

  db.User.update({ email: delEmail, isDeleted: true }, {
    where: {
      id: req.locals.member.id,
    },
  })
  .then(() => res.json({}))
  .catch(err => next(new BadRequestError(err)));
}

async function transferMember(req, res) {
  try {
    const { transferringMember } = req;
    const { shouldChargeReEnrollmentFree } = req.body;

    // Cancel user's active stripe subscriptions
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: transferringMember.id
      }
    });

    const { stripeCustomerId } = paymentProfile;
    const stripeCustomer = await stripe.getCustomer(stripeCustomerId);
    const { subscriptions } = stripeCustomer;
    if (shouldChargeReEnrollmentFree) {
      await stripe.issueCharge(RE_ENROLLMENT_PENALTY, stripeCustomerId, 'Re-Enrollment Penalty Charge(Transfer)');
    }
    for (const subscription of subscriptions.data) {
      if (!subscription.canceled_at) {
        await stripe.deleteSubscription(subscription.id, { at_period_end: true });
      }
    }

    await db.Subscription.destroy({
      where: {
        paymentProfileId: paymentProfile.id
      }
    });

    transferringMember.email = getDeletedEmailFormat(transferringMember.email);
    transferringMember.isDeleted = true;
    await transferringMember.save();
    return res.status(200).send({ memberId: transferringMember.id });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    checkUserDentistPermission,
    getMembers
  )
  .post(
    userRequired,
    validateBody(ADD_MEMBER),
    checkUserDentistPermission,
    addMember
  );


router
  .route('/:memberId')
  .get(
    userRequired,
    injectMemberFromUser(),
    getMember
  )
  .put(
    userRequired,
    injectMemberFromUser(),
    updateMember
  )
  .delete(
    userRequired,
    injectMemberFromUser(),
    deleteMember
  );

router
  .route('/transfer')
  .post(
    getTransferringMember,
    transferMember
  );

export default router;
