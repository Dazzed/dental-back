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
async function addMember(req, res, next) {
  let {
    member,
    parentMember
  } = req.body;
  const dentistId = member.dentistId;
  const response = await db.User.addAdditionalMember(member, dentistId, parentMember);

  member = {...member, id: response.id};
  const parentMemberId = parentMember.client ? parentMember.client.id : parentMember.id;

  try {
    const stripeResponse = await subscribeNewMember(parentMemberId, member, response.subscription);
    const sub = await db.Subscription.find({
      where: { clientId: response.id },
      include: [{
        model: db.Membership,
        as: 'membership'
      }]
    })
    const newMemberInfo = response;
    newMemberInfo.clientSubscription = sub.toJSON();
    newMemberInfo.membershipId = newMemberInfo.clientSubscription.membershipId;
    delete newMemberInfo.subscription;
    res.status(HTTPStatus.CREATED);
    res.json({ data: newMemberInfo });
  } catch (errors) {
    console.log("GOT ERRORS")
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
  const data = _.pick(req.body, ['firstName', 'lastName', 'birthDate',
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
    validateBody(ADD_MEMBER),
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
    injectMemberFromUser(),
    updateMember)
  .delete(
    userRequired,
    injectMemberFromUser(),
    deleteMember);

export default router;
