import { Router } from 'express';
import passport from 'passport';
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


const router = new Router({ mergeParams: true });


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


function addMember(req, res, next) {
  req.checkBody(MEMBER);

  const userId = req.params.userId;
  let member;
  let data;
  let dentistId;

  req
    .asyncValidationErrors(true)
    .then(() => {
      data = _.pick(req.body, ['email', 'firstName', 'lastName',
        'phone', 'birthDate', 'familyRelationship', 'sex', 'contactMethod']);

      // if user is me update id.
      if (userId === 'me') {
        data.addedBy = req.user.get('id');
      } else {
        data.addedBy = userId;
      }

      // if userId is undefined set body param
      if (userId === undefined) {
        data.addedBy = req.body.userId;
      }

      data.hash = 'NOT_SET';
      data.salt = 'NOT_SET';

      return db.User.create(data);
    })
    .then(_member => {
      member = _member;
      return db.Subscription.find({
        attributes: ['dentistId', 'id'],
        where: { clientId: data.addedBy },
        raw: true,
      });
    })
    .then(subscription => db.DentistInfo.find({
      attributes: ['membershipId', 'childMembershipId', 'userId'],
      where: { userId: subscription.dentistId },
      raw: true,
    }))
    .then(info => {
      dentistId = info.userId;
      const years = moment().diff(member.get('birthDate'), 'years', false);
      if (years < 13) {
        return db.Membership.find({ where: { id: info.childMembershipId } });
      }
      return db.Membership.find({ where: { id: info.membershipId } });
    })
    .then(membership =>
      Promise.all([
        member.createSubscription(membership, dentistId),
        member.createPhoneNumber({
          number: req.body.phone,
        }),
        membership
      ])
    )
    .then(([subscription, phone, membership]) => {
      const response = member.toJSON();
      response.membership = membership.toJSON();
      response.subscription = subscription.toJSON();
      response.phone = phone.toJSON().number;

      res.status(HTTPStatus.CREATED);
      res.json({ data: _.omit(response, ['salt', 'hash', 'dentistSpecialtyId',
        'authorizeId', 'isDeleted', 'paymentId', 'resetPasswordKey', 'verified'
      ]) });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


function updateMember(req, res, next) {
  const memberValidator = Object.assign({}, MEMBER);

  if (req.locals.member.email === req.body.email) {
    delete memberValidator.email;
  }

  req.checkBody(memberValidator);

  const data = _.pick(req.body, ['email', 'firstName', 'lastName',
    'birthDate', 'familyRelationship', 'sex', 'contactMethod']);

  req
    .asyncValidationErrors(true)
    .then(() => db.User.update(data, {
      where: { addedBy: req.params.userId, id: req.params.memberId },
    }))
    .then(() => {
      if (req.locals.member.phone !== req.body.phone) {
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
      next();
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


/**
 * Fill req.locals.familyMember with the requested member on url params,
 * if allowed call next middleware.
 *
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
  }).catch((error) => {
    next(error);
  });
}


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
  .catch(error => {
    next(error);
  });
}


function deleteMember(req, res) {
  const delEmail = `DELETED_${req.locals.member.email}`;

  db.User.update({ email: delEmail, isDeleted: true }, {
    where: {
      id: req.locals.member.id,
    },
  }).then(() => res.json({}));
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkUserDentistPermission,
    getMembers)
  .post(
    passport.authenticate('jwt', { session: false }),
    checkUserDentistPermission,
    addMember);


router
  .route('/:memberId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getMemberFromParam,
    getMember)
  .put(
    passport.authenticate('jwt', { session: false }),
    getMemberFromParam,
    updateMember,
    getMember)
  .delete(
    passport.authenticate('jwt', { session: false }),
    getMemberFromParam,
    deleteMember);


export default router;
