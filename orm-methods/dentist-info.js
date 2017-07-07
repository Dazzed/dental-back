/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

// import _ from 'lodash';
import db from '../models';

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {
  getFullOffice() {
    let office = {};
    let result = {};

    return db.DentistInfo.find({
      where: {
        id: this.get('id'),
      },
      attributes: {
        exclude: ['createdAt', 'updatedAt', 'userId', 'membershipId', 'childMembershipId'],
      },
      include: [{
        model: db.Membership,
        as: 'membership',
        attributes: {
          exclude: ['price', 'userId'],
        },
      }, {
        model: db.Membership,
        as: 'childMembership',
        attributes: {
          exclude: ['price', 'userId'],
        },
      }, {
        model: db.WorkingHours,
        as: 'workingHours',
        attributes: {
          exclude: ['createdAt', 'updatedAt', 'dentistInfoId'],
        },
      }, {
        model: db.MembershipItem,
        as: 'pricing',
        attributes: {
          exclude: ['dentistInfoId', 'pricingCodeId'],
        },
        include: [{
          model: db.PriceCodes,
          as: 'priceCode',
          attributes: {
            exclude: ['dentistInfoId'],
          },
        }]
      }, {
        model: db.DentistInfoPhotos,
        as: 'officeImages',
        attributes: ['url'],
      }, {
        model: db.DentistInfoService,
        as: 'services',
        include: [{
          model: db.Service,
          as: 'service'
        }],
      }],
    })
    .then((officesRes) => {
      office = officesRes;
      result = officesRes.toJSON();
      return office.membership.getPlanCosts();
    })
    .then((memPlanCosts) => {
      result.membership = memPlanCosts;
      return office.childMembership.getPlanCosts();
    })
    .then((memChildPlanCosts) => {
      result.childMembership = memChildPlanCosts;

      // Fix pricing codes
      result.pricing.forEach((p, i) => {
        result.pricing[i].code = p.priceCode.code;
        result.pricing[i].description = p.priceCode.description;
        delete result.pricing[i].priceCode;
      });
      // Fix Office Images
      result.officeImages = result.officeImages.map(o => o.url);
      // Fix services
      result.services = result.services.map(s => (s.service ? s.service.name || null : null));

      return Object.assign({}, office.toJSON(), result);
    });
  }
};

export const model = {};
