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
  NotFoundError
} from '../errors';

import {
  userRequired,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of member records
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getMembers(req, res, next) {
  let query;

  // Returns all clients grouped by main user.
  if (req.user.get('type') === 'dentist') {
    query = req.user.getClients();
  } else {
    query = req.user.getMyMembers();
  }

  return query
    .then(data => res.json({ data }))
    .catch(next);
}

/**
 * Adds a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function addMember(req, res, next) {
  req.checkBody(MEMBER);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const data = _.pick(req.body, ['firstName', 'lastName',
        'birthDate', 'familyRelationship', 'sex', 'membershipType']);

      return db.User.addMember(data, req.user);

      // if user is me update id.
      // if (userId === 'me') {
      //   data.addedBy = req.user.get('id');
      // } else {
      //   data.addedBy = userId;
      // }
    })
    .then(response => {
      res.status(HTTPStatus.CREATED);
      res.json({ data: response });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}

/**
 * Updates a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function updateMember(req, res, next) {
  const memberValidator = MEMBER;

  // if (req.locals.member.email === req.body.email) {
  //   delete memberValidator.email;
  // }

  req.checkBody(memberValidator);

  const data = _.pick(req.body, ['firstName', 'lastName',
    'birthDate', 'familyRelationship', 'sex', 'membershipType']);

  let userId = req.params.userId;
  if (userId === 'me') {
    userId = req.user.get('id');
  }

  req
    .asyncValidationErrors(true)
    .then(() => db.User.update(data, {
      where: { addedBy: userId, id: req.params.memberId },
    }))
    .then(() => {
      if (req.body.phone && req.locals.member.phone !== req.body.phone) {
        return db.Phone.update({ number: req.body.phone }, {
          where: { userId: req.params.memberId },
        });
      }

      return null;
    })
    .then(() => {
      const years = moment().diff(req.body.birthDate, 'years', false);
      const oldYears = moment().diff(
        req.locals.member.birthDate, 'years', false);
      let subscriptionId;

      if (years !== oldYears) {
        return db.Subscription.find({
          attributes: ['dentistId', 'id'],
          where: {
            clientId: req.params.memberId,
          },
          order: '"createdAt" DESC',
          raw: true,
        }).then(subscription => {
          subscriptionId = subscription.id;

          return db.DentistInfo.find({
            attributes: ['membershipId', 'childMembershipId'],
            where: {
              userId: subscription.dentistId,
            },
            raw: true,
          });
        }).then(info => {
          if (years < 13) {
            return db.Membership.find({
              where: { id: info.childMembershipId }
            });
          }
          return db.Membership.find({ where: { id: info.membershipId } });
        }).then(membership => {
          req.locals.member.subscription.total = membership.price;
          req.locals.member.subscription.monthly = membership.monthly;
          req.locals.member.subscription.membershipId = membership.id;

          return db.Subscription.update({
            total: membership.price,
            monthly: membership.monthly,
            membershipId: membership.id,
          }, {
            where: {
              clientId: req.locals.member.id,
              id: subscriptionId,
            }
          });
        });
      }
      return null;
    })
    .then(() => {
      Object.assign(req.locals.member, data);
      req.locals.member.phone = req.body.phone;
      return next();
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}

/**
 * Injects the member requested into the request object
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getMemberFromParam(req, res, next) {
  const memberId = req.params.memberId;
  const userId = req.params.userId;
  const addedBy = userId === 'me' ? req.user.get('id') : userId;

  db.User.getMyMember(addedBy, memberId).then((member) => {
    if (!member) {
      return next(new NotFoundError());
    }

    req.locals.member = member;
    return next();
  }).catch(error => next(error));
}

/**
 * Gets a specific member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getMember(req, res, next) {
  const subscription = req.locals.member.subscription;
  const membershipId = subscription ? subscription.membershipId : 0;

  db.Membership.find({
    where: { id: membershipId }
  })
  .then(membership => {
    if (membership) req.locals.member.membership = membership;
    return res.json({ data: req.locals.member });
  })
  .catch(error => next(error));
}

/**
 * Deletes a member record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
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
    checkUserDentistPermission,
    addMember);


router
  .route('/:memberId')
  .get(
    userRequired,
    getMemberFromParam,
    getMember)
  .put(
    userRequired,
    getMemberFromParam,
    updateMember,
    getMember)
  .delete(
    userRequired,
    getMemberFromParam,
    deleteMember);

export default router;
