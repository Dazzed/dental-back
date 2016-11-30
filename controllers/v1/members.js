import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';
import HTTPStatus from 'http-status';
import moment from 'moment';

import db from '../../models';

import {
  FAMILY_MEMBER,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../errors';


const router = new Router({ mergeParams: true });


function checkPermissions(req, res, next) {
  const userId = req.params.userId;

  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canEdit && req.user.get('type') !== 'dentist') {
    return next(new ForbiddenError());
  }

  // if (req.user.get('type') !== 'dentist' && userId !== 'me') {
  //   return req.user.getCurrentSubscription(userId)
  //   .then(subscription => {
  //     if (subscription) {
  //       next();
  //     } else {
  //       return next(new ForbiddenError());
  //     }
  //   })
  //   .catch(next);
  // }

  return next();
}

// TODO: Move to new schema
/**
 * Fill req.locals.familyMember with the requested member on url params,
 * if allowed call next middleware.
 *
 */
function getFamilyMemberFromParam(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  // FIXME: control if dentist has permission to edit

  const query = {
    where: {
      id: req.params.familyMemberId,
      isDeleted: false,
    }
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = userId === 'me' ? req.user.get('id') : userId;
  }

  return db.FamilyMember.find(query).then((member) => {
    if (!member) {
      return next(new NotFoundError());
    }

    req.locals.familyMember = member;
    return next();
  }).catch((error) => {
    next(error);
  });
}


function getMembers(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canShow =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canShow) {
    return next(new ForbiddenError());
  }

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


function getFamilyMember(req, res) {
  res.json({ data: req.locals.familyMember.toJSON() });
}


function addFamilyMember(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canCreate =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin' || req.user.get('type') === 'dentist';

  if (!canCreate) {
    return next(new ForbiddenError());
  }

  req.checkBody(FAMILY_MEMBER);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body,
    ['email', 'firstName', 'lastName', 'phone', 'birthDate', 'familyRelationship']);

  // if user is me update id.
  if (userId === 'me') {
    data.userId = req.user.get('id');
  } else {
    data.userId = userId;
  }

  // if userId is undefined set body param
  if (userId === undefined) {
    data.userId = req.body.userId;
  }

  let subscription;

  return db.FamilyMember.create(data).then((member) => {
    // NOTE: work on latest subscription
    // TODO: improve query
    db.Subscription.find({
      attributes: ['dentistId', 'id'],
      where: {
        clientId: data.userId,
      },
      raw: true,
    }).then(_subscription => {
      subscription = _subscription;

      return db.DentistInfo.find({
        attributes: ['membershipId', 'childMembershipId'],
        where: {
          userId: subscription.dentistId,
        },
        raw: true,
      });
    }).then(info => {
      const years = moment().diff(member.get('birthDate'), 'years', false);
      if (years < 13) {
        return db.Membership.find({ where: { id: info.childMembershipId } });
      }
      return db.Membership.find({ where: { id: info.membershipId } });
    }).then(membership =>
      member.createSubscription({
        total: membership.price,
        monthly: membership.monthly,
        subscriptionId: subscription.id,
      })
    );

    res.status(HTTPStatus.CREATED);
    res.json({ data: member.toJSON() });
  });
}

function updateFamilyMember(req, res, next) {
  req.checkBody(FAMILY_MEMBER);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body,
    ['email', 'firstName', 'lastName', 'phone', 'birthDate', 'familyRelationship']);

  // if userId is undefined set body param, this should only for admin endpoints
  if (req.params.userId === undefined) {
    data.userId = req.body.userId;
  }

  const firstYears = moment()
    .diff(req.locals.familyMember.get('birthDate'), 'years', false);

  return req.locals.familyMember.update(data).then((member) => {
    const years = moment().diff(member.get('birthDate'), 'years', false);
    if (years !== firstYears) {
      let subscription;
      // TODO: improve query
      db.Subscription.find({
        attributes: ['dentistId', 'id'],
        where: {
          clientId: req.params.userId === 'me' ?
            req.user.get('id') : req.params.userId,
        },
        raw: true,
      }).then(_subscription => {
        subscription = _subscription;

        return db.DentistInfo.find({
          attributes: ['membershipId', 'childMembershipId'],
          where: {
            userId: subscription.dentistId,
          },
          raw: true,
        });
      }).then(info => {
        if (years < 13) {
          return db.Membership.find({ where: { id: info.childMembershipId } });
        }
        return db.Membership.find({ where: { id: info.membershipId } });
      }).then(membership =>
        // FIXME: only update current subscription
        db.MemberSubscription.update({
          total: membership.price,
          monthly: membership.monthly,
          subscriptionId: subscription.id,
        }, { where: {
          memberId: member.get('id'),
          subscriptionId: subscription.id,
        } })
      );
    }
    res.json({ data: member.toJSON() });
  });
}


function deleteFamilyMember(req, res) {
  req.locals.familyMember.update({ isDeleted: true }).then(() => res.json({}));
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkPermissions,
    getMembers)
  .post(
    passport.authenticate('jwt', { session: false }),
    addFamilyMember);


router
  .route('/:familyMemberId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getFamilyMemberFromParam,
    getFamilyMember)
  .put(
    passport.authenticate('jwt', { session: false }),
    getFamilyMemberFromParam,
    updateFamilyMember)
  .delete(
    passport.authenticate('jwt', { session: false }),
    getFamilyMemberFromParam,
    deleteFamilyMember);


export default router;
