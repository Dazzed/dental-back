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
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: {
      id: req.params.familyMemberId,
      isDeleted: false,
    }
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
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


// TODO: add pagination and filters?
function getFamilyMembers(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: { isDeleted: false },
    include: [{
      model: db.MemberSubscription,
      as: 'subscriptions',
      attributes: { exclude: ['memberId', 'membershipId', 'subscriptionId'] },
    }]
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  return db.FamilyMember.findAll(query).then((members) =>
      res.json({ data: members.map(member => {
        const m = member.toJSON();
        const r = _.omit(m, 'subscriptions');
        r.subscription = m.subscriptions[0];
        return r;
      }) })
  ).catch((error) => {
    next(error);
  });
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
    req.user.get('type') === 'admin';

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
        clientId: req.user.get('id'),
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
          clientId: req.user.get('id'),
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
    getFamilyMembers)
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
