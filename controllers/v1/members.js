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
  .then(data => res.json({ data }))
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Adds a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function addMember(req, res, next) {
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
      next(new BadRequestError(errors));
    }

    next(errors);
  });
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
function updateMember(req, res, next) {
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
    Object.assign(req.locals.member, data);
    req.locals.member.phone = req.body.phone;
    res.json();
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      next(new BadRequestError(errors));
    }

    next(errors);
  });
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
