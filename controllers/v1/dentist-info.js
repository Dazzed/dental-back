import { Router } from 'express';
import passport from 'passport';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';

import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../errors';


const router = new Router({ mergeParams: true });


/**
 * Fill req.locals.dentistInfo with the requested member on url params,
 * if allowed call next middleware.
 *
 */
function getDentistInfoFromParams(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    (req.user.get('type') === 'admin' && userId !== 'me');

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: {},
    attributes: {
      exclude: ['userId'],
    },
    include: [{
      model: db.WorkingHours,
      as: 'workingHours',
      attributes: { exclude: ['dentistInfoId'] },
    }, {
      model: db.Membership,
      as: 'membership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      include: [{
        model: db.MembershipItem,
        as: 'items',
        attributes: {
          exclude: ['membershipId'],
        },
      }],
    }, {
      model: db.Service,
      as: 'services',
    }],
  };

  if (req.params.dentistInfoId) {
    query.where.id = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  // console.log(query);
  return db.DentistInfo.find(query).then((dentistInfo) => {
    if (!dentistInfo) {
      return next(new NotFoundError());
    }

    req.locals.dentistInfo = dentistInfo;
    return next();
  }).catch((error) => {
    next(error);
  });
}


function getDentistInfo(req, res) {
  res.json({
    data: _.omit(req.locals.dentistInfo.toJSON(), ['membershipId']),
  });
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentistInfoFromParams,
    getDentistInfo);


export default router;
