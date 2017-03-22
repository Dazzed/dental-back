import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';

import db from '../../models';
import { updateTotalMembership } from '../../utils/helpers';

import {
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
      orderBy: 'createdAt DESC',
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
      model: db.Membership,
      as: 'childMembership',
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
    order: [
      [
        { model: db.Membership, as: 'membership' },
        { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ],
      [
        { model: db.Membership, as: 'childMembership' },
        { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ]
    ]
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


function updateDentistInfo(req, res, next) {
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
  };

  if (req.params.dentistInfoId) {
    query.where.id = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  // Update dentinst info
  return db.DentistInfo
    .find(query)
    .then((info) => {
      const queries = [];

      // update info it self
      queries.push(info.update({
        officeName: req.body.officeName,
        url: req.body.url,
        email: req.body.email,
        phone: req.body.phone,
        message: req.body.message,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zipCode: req.body.zipCode,
      }));

      // update membership items
      req.body.membership.items.forEach(item => {
        queries.push(db.MembershipItem.update({
          price: item.price,
        }, {
          where: {
            membershipId: info.get('membershipId'),
            pricingCode: item.pricingCode,
          },
        }));
      });

      updateTotalMembership(req.body.membership);

      // update membership
      queries.push(db.Membership.update({
        recommendedFee: req.body.membership.recommendedFee,
        activationCode: req.body.membership.activationCode,
        discount: req.body.membership.discount,
        price: req.body.membership.price,
        withDiscount: req.body.membership.withDiscount,
        monthly: req.body.membership.monthly,
      }, { where: { id: info.get('membershipId') } }));


      // update child membership items
      req.body.childMembership.items.forEach(item => {
        queries.push(db.MembershipItem.update({
          price: item.price,
        }, {
          where: {
            membershipId: info.get('childMembershipId'),
            pricingCode: item.pricingCode,
          },
        }));
      });

      updateTotalMembership(req.body.childMembership);

      // update membership
      queries.push(db.Membership.update({
        recommendedFee: req.body.childMembership.recommendedFee,
        activationCode: req.body.childMembership.activationCode,
        discount: req.body.childMembership.discount,
        price: req.body.childMembership.price,
        withDiscount: req.body.childMembership.withDiscount,
        monthly: req.body.childMembership.monthly,
      }, { where: { id: info.get('childMembershipId') } }));


      // update working hours
      req.body.workingHours.forEach(workingHour => {
        queries.push(db.WorkingHours.update({
          isOpen: workingHour.isOpen,
          startAt: workingHour.startAt,
          endAt: workingHour.endAt,
        }, {
          where: {
            dentistInfoId: info.get('id'),
            day: workingHour.day,
          },
        }));
      });

      // update services
      for (let service in req.body.services) {  // eslint-disable-line
        const id = parseInt(service.replace(/[^0-9.]/g, ''), 10);
        const shouldAdd = req.body.services[service];

        if (shouldAdd) {
          queries.push(info.addService(id));
        } else {
          queries.push(info.removeService(id));
        }
      }

      return Promise.all(queries);
    }).then(() => {
      next();
    }).catch(next);
}


function getDentistInfo(req, res) {
  const json = req.locals.dentistInfo.toJSON();

  json.services.forEach(item => {
    delete item.dentistInfoService;
  });

  res.json({
    data: _.omit(json, ['membershipId']),
  });
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentistInfoFromParams,
    getDentistInfo)
  .post(
    passport.authenticate('jwt', { session: false }),
    updateDentistInfo,
    getDentistInfoFromParams,
    getDentistInfo);


export default router;
