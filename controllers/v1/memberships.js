import { Router } from 'express';
import passport from 'passport';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';

import {
  MEMBERSHIP,
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
function getMembershipFromParams(req, res, next) {
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
      id: req.params.membershipId,
    }
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
    query.where.isDeleted = false;  // this to save
  }

  return db.Membership.find(query).then((membership) => {
    if (!membership) {
      return next(new NotFoundError());
    }

    req.locals.membership = membership;
    return next();
  }).catch((error) => {
    next(error);
  });
}


// TODO: add pagination and filters?
function getMemberships(req, res, next) {
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
    attributtes: { exclude: ['isDeleted'] },
    where: {
      isDeleted: false,
    },
    raw: true
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  return db.Membership.findAll(query).then((members) =>
    res.json({ data: members || [] })
  ).catch((error) => {
    next(error);
  });
}


function getMembership(req, res) {
  res.json({
    data: _.omit(req.locals.membership.toJSON(), ['isDeleted']),
  });
}


function addMembership(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  let canCreate = req.user.get('type') === 'dentist' &&
    (userId === 'me' || req.user.get('id') === parseInt(userId, 10));

  // enable admin to add memberships
  canCreate |= req.user.get('type') === 'admin';

  // only can add to over userId
  if (!canCreate) {
    return next(new ForbiddenError());
  }

  req.checkBody(MEMBERSHIP);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body, ['name', 'price', 'description']);

  // if userId is not set or is me set to loggedin user id.
  if (userId === 'me') {
    data.userId = req.user.get('id');
  }

  // if userId is undefined set body param
  if (userId === undefined) {
    data.userId = req.body.userId;
  }

  return db.Membership.create(data).then((membership) => {
    res.status(HTTPStatus.CREATED);
    res.json({
      data: _.omit(membership.toJSON(), ['isDeleted']),
    });
  });
}


function updateMembership(req, res, next) {
  req.checkBody(MEMBERSHIP);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body, ['name', 'price', 'description']);

  // if userId is undefined set body param
  if (req.params.userId === undefined) {
    data.userId = req.body.userId;
  }

  return req.locals.membership.update(data).then((membership) => {
    res.json({
      data: _.omit(membership.toJSON(), ['isDeleted']),
    });
  });
}


function deleteMembership(req, res) {
  req.locals.membership.update({ isDeleted: true }).then(() => res.end());
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getMemberships)
  .post(
    passport.authenticate('jwt', { session: false }),
    addMembership);


router
  .route('/:membershipId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getMembershipFromParams,
    getMembership)
  .put(
    passport.authenticate('jwt', { session: false }),
    getMembershipFromParams,
    updateMembership)
  .delete(
    passport.authenticate('jwt', { session: false }),
    getMembershipFromParams,
    deleteMembership);


export default router;
