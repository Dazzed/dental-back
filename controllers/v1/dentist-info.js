/* eslint max-len:0 */

// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';
import async from 'async';
import db from '../../models';

import { userRequired, injectDentistInfo } from '../middlewares';
import { MembershipMethods } from '../../orm-methods/memberships';
import { SUBSCRIPTION_STATES_LOOKUP } from '../../config/constants';

import {
  ForbiddenError,
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getDentistInfo(req, res, next) {
  let dentistInfo = req.locals.dentistInfo.toJSON();
  const userId = req.user.get('type') === 'admin' ? req.params.userId : req.user.get('id');
  dentistInfo = _.omit(dentistInfo, ['membershipId', 'childMembershipId', 'pricing']);

  return Promise.resolve()
  .then(() => (
    db.MembershipItem.findAll({
      where: { dentistInfoId: dentistInfo.id },
      include: [{
        model: db.PriceCodes,
        as: 'priceCode'
      }]
    })
  ))
  .then((items) => {
    // Inject the price codes
    dentistInfo.priceCodes = items.map((i) => {
      const temp = i.priceCode.toJSON();
      temp.price = i.get('price');
      return i.priceCode;
    });

    // Unwrap the services
    dentistInfo.services = dentistInfo.services.map(item => item.service);

    return db.Subscription.count({
      where: {
        dentistId: userId,
        status: SUBSCRIPTION_STATES_LOOKUP.active,
      }
    });
  })
  .then((activeMemberCount) => {
    // Inject active member counts
    dentistInfo.activeMemberCount = activeMemberCount;

    if (req.user.get('type') === 'dentist') {
      res.json({
        data: dentistInfo
      });
    } else {
      const data = req.user.toJSON();
      data.dentistInfo = dentistInfo;
      res.json({ data });
    }
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Updates the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
async function updateDentistInfo(req, res, next) {
  const userId = req.params.dentistInfoId;

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
    },
    {
      model: db.DentistInfoService,
      as: 'services'
    }]
  };

  if (req.params.dentistInfoId) {
    query.where.userId = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  const dentistInfo = await db.DentistInfo.find(query);
  if (dentistInfo == null) {
    return next(new BadRequestError('No dentist info object was found'));
  }
    console.log("THE BODY",req.body)
    const queries = [];
    const user = req.body.user;
    const officeInfo = req.body.officeInfo;
    const officeImages = req.body.officeImages;
    const pricing = req.body.pricing;
    const membership = req.body.officeInfo.memberships;
    const childMembership = req.body.childMembership;
    const workingHours = req.body.workingHours;
    const services = req.body.services;

    if (user) {
      queries.push(
        req.user.update({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          zipCode: user.zipCode,
          dentistSpecialtyId: user.dentistSpecialtyId
        })
      );
    }

    // update info itself.
    if (officeInfo) {
      queries.push(
        dentistInfo.update({
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
        })
      );
    }

    if (pricing.codes) {
      // update pricing codes.
      pricing.codes.forEach((item) => {
        queries.push(
          db.MembershipItem.update({
            price: item.price,
          }, {
            where: {
              id: item.id,
            }
          }))
      });
    }

    // TODO(sameep): Fix dentist edit form for memberships.
    if (membership.length > 0) {
      membership.forEach(m => {
        queries.push(
          db.Membership.update({
            active: false
          },
          {
            where: {
              id: m.id
            }
          })
        );
        queries.push(
          db.Membership.create({
            ..._.omit(m, ['id']),
            dentistInfoId: user.dentistInfo.id,
            userId: user.id
          })
        );
      });
    }

    if (user.phone) {
      queries.push(
        db.Phone.update({
          number: user.phone,
        }, {
          where: {
            userId: dentistInfo.get('userId'),
          }
        })
      );
    }

    if (workingHours) {
      // update working hours
      workingHours.forEach((workingHour) => {
        queries.push(
          db.WorkingHours.update({
            isOpen: workingHour.isOpen,
            startAt: workingHour.startAt,
            endAt: workingHour.endAt,
          }, {
            where: {
              dentistInfoId: dentistInfo.get('id'),
              day: workingHour.day,
            }
          })
        );
      });
    }

    if (officeInfo.services) {
      const previousServices = dentistInfo.get('services');
      // Go through the services to add.
      for (const service of officeInfo.services) {
        const serviceAlreadyExists =
            previousServices.find(s => s.dataValues.serviceId === service.id);
        if (!serviceAlreadyExists) {
          queries.push(db.DentistInfoService.upsert({
            serviceId: service.id,
            dentistInfoId: dentistInfo.get('id')
          }));
        }
      }

      // Go through the services to destroy.
      for (const service of previousServices) {
        const serviceShouldExist =
            officeInfo.services.find(s => s.id === service.dataValues.serviceId);
        if (!serviceShouldExist) {
          queries.push(db.DentistInfoService.destroy({
            where: {
              serviceId: service.dataValues.serviceId,
              dentistInfoId: dentistInfo.get('id'),
            }
          }));
        }
      }
    }

    if (officeInfo.officeImages) {
      // update office images.
      const previousImages = dentistInfo.get('officeImages');
      officeInfo.officeImages.forEach((imageUrl) => {
        const imageAlreadyExists =
            previousImages.find(s => s.dataValues.url === imageUrl);
        if (!imageAlreadyExists) {
          queries.push(
            db.DentistInfoPhotos.upsert({
              url: imageUrl,
              dentistInfoId: dentistInfo.get('id')
            })
          );
        }
      });
    }
  Promise.all(queries).then(data => {
    return;
  },err => {
    console.log("Error in dentist update");
    console.log(err);
  });
  res.json({});
}

/**
 * Delete a dentist image.
 */
function deleteDentistInfoPhoto (req, res, next) {
  return db.DentistInfo.find({ id: req.params.dentistInfoId })
    .then((dentistInfo) => {
      if (!dentistInfo) {
        return false;
      }

      return dentistInfo.get('userId') === req.user.get('id');
    })
    .then((isDentistOwner) => {
      if (!isDentistOwner) {
        return Promise.reject(new ForbiddenError('Not the dentist owner'));
      }

      return db.DentistInfoPhotos.destroy({
        where: {
          id: req.params.dentistInfoPhotoId,
          dentistInfoId: req.params.dentistInfoId,
        }
      }).then((result) => res.json({ result }));
    })
    .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    injectDentistInfo(),
    getDentistInfo);

router
  .route('/:dentistInfoId/photos/:dentistInfoPhotoId')
  .delete(
    userRequired,
    deleteDentistInfoPhoto);

router
  .route('/:dentistInfoId')
  .post(
    userRequired,
    updateDentistInfo);

export default router;
