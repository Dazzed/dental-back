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
      model: db.MembershipItem,
      as: 'pricing',
      attributes: {
        exclude: ['dentistInfoId']
      }
    }, {
      model: db.Membership,
      as: 'membership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.Membership,
      as: 'childMembership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.DentistInfoService,
      as: 'services',
      attributes: {
        exclude: ['serviceId', 'dentistInfoId']
      },
      include: [{
        model: db.Service,
        as: 'service',
        raw: true
      }]
    }, {
      model: db.DentistInfoPhotos,
      as: 'officeImages',
      attributes: ['url']
    }],
    order: [
      [
        { model: db.Membership, as: 'membership' },
        // { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ],
      [
        { model: db.Membership, as: 'childMembership' },
        // { model: db.MembershipItem, as: 'items' },
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
    include: [{
      model: db.DentistInfoPhotos,
      as: 'officeImages'
    }]
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
      const officeInfo = req.body.officeInfo;
      const officeImages = officeInfo.officeImages;
      const pricing = req.body.pricing;
      const membership = req.body.membership;
      const childMembership = req.body.childMembership;
      const workingHours = req.body.workingHours;
      const services = req.body.services;

      // update info itself.
      queries.push(info.update({
        officeName: officeInfo.officeName,
        url: officeInfo.url,
        phone: officeInfo.phone,
        message: officeInfo.message,
        address: officeInfo.address,
        city: officeInfo.city,
        state: officeInfo.state,
        zipCode: officeInfo.zipCode,
        logo: officeInfo.logo,
        acceptsChildren: officeInfo.acceptsChildren,
        childStartingAge: officeInfo.childStartingAge,
        marketplaceOptIn: officeInfo.marketplaceOptIn
      }));

      if (pricing) {
        // update pricing codes.
        pricing.codes.forEach(item => {
          queries.push(db.MembershipItem.update({
            price: item.amount,
          }, {
            where: {
              dentistInfoId: info.get('id'),
              pricingCode: item.code,
            },
          }).then(obj => {
            if (obj[0] === 0) {
              return db.MembershipItem.create({
                pricingCode: item.code,
                price: item.amount,
                dentistInfoId: info.get('id')
              });
            }
            return obj;
          }));
        });
      }

      if (membership) {
        updateTotalMembership(membership);

        // update adult membership.
        queries.push(db.Membership.update({
          recommendedFee: membership.recommendedFee,
          activationCode: membership.activationCode,
          discount: membership.discount,
          price: membership.price,
          withDiscount: membership.withDiscount,
          monthly: membership.monthly,
        }, { where: { id: info.get('membershipId') } }));
      }

      if (childMembership) {
        // // update child membership items
        // childMembership.items.forEach(item => {
        //   queries.push(db.MembershipItem.update({
        //     price: item.amount,
        //   }, {
        //     where: {
        //       membershipId: info.get('childMembershipId'),
        //       pricingCode: item.pricingCode,
        //     },
        //   }));
        // });

        updateTotalMembership(childMembership);

        // update child membership.
        queries.push(db.Membership.update({
          recommendedFee: childMembership.recommendedFee,
          activationCode: childMembership.activationCode,
          discount: childMembership.discount,
          price: childMembership.price,
          withDiscount: childMembership.withDiscount,
          monthly: childMembership.monthly,
        }, { where: { id: info.get('childMembershipId') } }));
      }


      if (workingHours) {
        // update working hours
        workingHours.forEach(workingHour => {
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
      }

      if (services) {
        // update services.
        for (let service in services) {  // eslint-disable-line
          const id = parseInt(service.replace(/[^0-9.]/g, ''), 10);
          const shouldAdd = services[service];

          if (shouldAdd) {
            queries.push(info.addService(id));
          } else {
            queries.push(info.removeService(id));
          }
        }
      }

      if (officeImages) {
        const existingImages = info.get('officeImages');

        // update office images.
        for (const item in officeImages) {
          if (!existingImages.find(image => image.url === officeImages[item])) {
            db.DentistInfoPhotos.create({
              url: officeImages[item],
              dentistInfoId: info.get('id')
            });
          }
        }
      }

      return Promise.all(queries);
    }).then(() => {
      next();
    }).catch(next);
}


function getDentistInfo(req, res) {
  let dentistInfo = req.locals.dentistInfo.toJSON();
  dentistInfo = _.omit(dentistInfo, ['membershipId', 'childMembershipId']);
  dentistInfo.services = dentistInfo.services.map(item => item.service);

  if (req.user.get('type') === 'dentist') {
    res.json({
      data: dentistInfo
    });
  } else {
    const user = _.omit(req.user.toJSON(), ['authorizeId', 'paymentId']);
    user.dentistInfo = dentistInfo;

    res.json({
      data: user
    });
  }
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentistInfoFromParams,
    getDentistInfo);

router
  .route('/:dentistInfoId?')
  .post(
    passport.authenticate('jwt', { session: false }),
    updateDentistInfo,
    getDentistInfoFromParams,
    getDentistInfo);


export default router;
