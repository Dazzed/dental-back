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
        data: dentistInfo,
        stripe_public_key: process.env.STRIPE_PUBLIC_KEY
      });
    } else {
      const data = req.user.toJSON();
      data.dentistInfo = dentistInfo;
      res.json({ data, stripe_public_key: process.env.STRIPE_PUBLIC_KEY });
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
  const userId = req.params.dentistId;

  const { dentistInfo } = req.locals;
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

  if (pricing) {
    const currentMemberships = req.locals.dentistInfo.memberships.map(m => m.toJSON());
    const alteredMemberships = [];
    for (const key in pricing) {
      if (key !== "codes") {
        alteredMemberships.push(pricing[key]);
      }
    }
    currentMemberships.forEach(cm => {
      const alteredMembership = alteredMemberships.find(am => am.id === cm.id);
      if (alteredMembership) {
        if (cm.price !== alteredMembership.value) {
          // Disable old membership
          queries.push(
            db.Membership.update({
              active: false
            },
            {
              where: {
                id: cm.id
              }
            })
          );
          // Create New membership
          queries.push(
            db.Membership.create({
              name: cm.name,
              userId: user.id,
              discount: cm.discount,
              price: alteredMembership.value,
              type: cm.type,
              subscription_age_group: cm.subscription_age_group,
              dentistInfoId: user.dentistInfo.id,
              active: true
            })
          );
        }
      }
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

  // if (officeInfo.services) {
  //   const previousServices = dentistInfo.get('services');
  //   // Go through the services to add.
  //   for (const service of officeInfo.services) {
  //     const serviceAlreadyExists =
  //         previousServices.find(s => s.dataValues.serviceId === service.id);
  //     if (!serviceAlreadyExists) {
  //       queries.push(db.DentistInfoService.upsert({
  //         serviceId: service.id,
  //         dentistInfoId: dentistInfo.get('id')
  //       }));
  //     }
  //   }

  //   // Go through the services to destroy.
  //   for (const service of previousServices) {
  //     const serviceShouldExist =
  //         officeInfo.services.find(s => s.id === service.dataValues.serviceId);
  //     if (!serviceShouldExist) {
  //       queries.push(db.DentistInfoService.destroy({
  //         where: {
  //           serviceId: service.dataValues.serviceId,
  //           dentistInfoId: dentistInfo.get('id'),
  //         }
  //       }));
  //     }
  //   }
  // }

  if (officeInfo.officeImages) {
    // update office images.
    const previousImages = dentistInfo.get('officeImages');

    // Go through the images to add.
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

    // Go through the office images to destroy.
    for (const instance of previousImages) {
      const imageShouldExist =
          officeInfo.officeImages.find(s => s.url === instance.dataValues.url);
      if (!imageShouldExist) {
        queries.push(db.DentistInfoPhotos.destroy({
          where: {
            url: instance.dataValues.url,
            dentistInfoId: dentistInfo.get('id'),
          }
        }));
      }
    }
  }
  Promise.all(queries).then(data => {
    return res.status(200).send({});
  },err => {
    console.log("Error in dentist update");
    console.log(err);
    return res.status(500).send(err);
  });
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
  .route('/:dentistId/edit/:dentistInfoId')
  .post(
    userRequired,
    injectDentistInfo('dentistId'),
    updateDentistInfo);

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

export default router;
