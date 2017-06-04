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
} from '../../utils/schema-validators';

import {
  BadRequestError,
} from '../errors';

import {
  userRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of member records
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMembers(req, res) {
  let query;

  // Returns all clients grouped by main user.
  if (req.user.get('type') === 'dentist') {
    query = req.user.getClients();
  } else {
    query = req.user.getMyMembers();
  }

  query
  .then(data => res.json({ data }))
  .catch(err => res.json(new BadRequestError(err)));
}

/**
 * Adds a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function addMember(req, res) {
  Promise.resolve()
  .then(() => {
    const data = _.pick(req.body, ['firstName', 'lastName',
      'birthDate', 'familyRelationship', 'sex', 'membershipType']);

    return db.User.addMember(data, req.user);
  })
  .then((response) => {
    res.status(HTTPStatus.CREATED);
    res.json({ data: response });
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      res.json(new BadRequestError(errors));
    }

    res.json(errors);
  });
}

/**
 * Gets a specific member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMember(req, res) {
  const subscription = req.locals.member.subscription;
  const membershipId = subscription ? subscription.membershipId : 0;

  db.Membership.find({
    where: { id: membershipId }
  })
  .then((membership) => {
    if (membership) req.locals.member.membership = membership;
    return res.json({ data: req.locals.member });
  })
  .catch(error => res.json(error));
}

/**
 * Updates a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function updateMember(req, res) {
  const data = _.pick(req.body, ['firstName', 'lastName',
    'birthDate', 'familyRelationship', 'sex', 'membershipType']);

  let userId = req.params.userId;

  if (userId === 'me') {
    userId = req.user.get('id');
  }

  // FIXME: user update does not use a transaction

  Promise.resolve()
  // Fetch the user record to update
  .then(() => db.User.update(data, {
    where: { addedBy: userId, id: req.params.memberId },
  }))
  // Update the phone number
  .then(() => {
    if (req.body.phone && req.locals.member.phone !== req.body.phone) {
      return db.Phone.update({ number: req.body.phone }, {
        where: { userId: req.params.memberId },
      });
    }

    return null;
  })
  .then(() => {
    // let subscriptionId;

    // FIXME: Removed since updating subscriptions by age will be automatic
    // const years = moment().diff(req.body.birthDate, 'years', false);
    // const oldYears = moment().diff(req.locals.member.birthDate, 'years', false);

    // if (years !== oldYears) {
    //   return db.Subscription.find({
    //     attributes: ['dentistId', 'id'],
    //     where: {
    //       clientId: req.params.memberId,
    //     },
    //     order: '"status" DESC',
    //     raw: true,
    //   }).then(subscription => {
    //     subscriptionId = subscription.id;

    //     return db.DentistInfo.find({
    //       attributes: ['membershipId', 'childMembershipId'],
    //       where: {
    //         userId: subscription.dentistId,
    //       },
    //       raw: true,
    //     });
    //   }).then(info => {
    //     if (years < 13) {
    //       return db.Membership.find({
    //         where: { id: info.childMembershipId }
    //       });
    //     }
    //     return db.Membership.find({ where: { id: info.membershipId } });
    //   }).then(membership => {
    //     req.locals.member.subscription.total = membership.price;
    //     req.locals.member.subscription.monthly = membership.monthly;
    //     req.locals.member.subscription.membershipId = membership.id;

    //     return db.Subscription.update({
    //       amount: membership.price,
    //       membershipId: membership.id,
    //     }, {
    //       where: {
    //         clientId: req.locals.member.id,
    //         id: subscriptionId,
    //       }
    //     });
    //   });
    // }

    return null;
  })
  .then(() => {
    Object.assign(req.locals.member, data);
    req.locals.member.phone = req.body.phone;
    res.json();
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      res.json(new BadRequestError(errors));
    }

    res.json(errors);
  });
}

/**
 * Deletes a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function deleteMember(req, res) {
  const delEmail = `DELETED_${req.locals.member.email}`;

  db.User.update({ email: delEmail, isDeleted: true }, {
    where: {
      id: req.locals.member.id,
    },
  }).then(() => res.json({}));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    checkUserDentistPermission,
    getMembers)
  .post(
    userRequired,
    validateBody(MEMBER),
    checkUserDentistPermission,
    addMember);


router
  .route('/:memberId')
  .get(
    userRequired,
    injectMemberFromUser(),
    getMember)
  .put(
    userRequired,
    validateBody(MEMBER),
    injectMemberFromUser(),
    updateMember,
    getMember)
  .delete(
    userRequired,
    injectMemberFromUser(),
    deleteMember);

export default router;
