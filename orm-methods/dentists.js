// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import db from '../models';

import {
  instance as UserInstance,
} from './users';

import { MembershipMethods } from './memberships';

// ────────────────────────────────────────────────────────────────────────────────
// ORM METHODS

/**
 * Methods related to providing additional information about Memberships
 */
export default {
  /**
   * Prepares a promise for fetching a dentist's information
   *
   * @param {Object} req - express request
   * @param {Object} res - express response
   * @param {Function} next - next middleware function
   * @return {Promise<Dentist>}
   */
  fetchDentist(userId) {
    return new Promise((resolve, reject) => {
      userId = (parseInt(userId, 10) || 0);
      UserInstance.getFullDentist(userId)
      .then((d) => {
        if (d === null) resolve(null);
        else {
          // Retrieve Price Codes
          db.MembershipItem.findAll({
            where: { dentistInfoId: d.dentistInfo.id },
            include: [{
              model: db.PriceCodes,
              as: 'priceCode'
            }]
          }).then((items) => {
            d.dentistInfo.priceCodes = items.map(i => {
              const temp = i.priceCode.toJSON();
              temp.price = i.get('price');
              return i.priceCode;
            });
            // Calculate membership costs
            MembershipMethods
            .calculateCosts(d.dentistInfo.id, [
              d.dentistInfo.membership.id,
              d.dentistInfo.childMembership.id,
            ])
            .then((fullCosts) => {
              fullCosts.forEach((cost) => {
                if (d.dentistInfo.membership.id === cost.membershipId) {
                  d.dentistInfo.membership.fullCost = cost.fullCost;
                  d.dentistInfo.membership.savings = Math.max((cost.fullCost - (parseInt(d.dentistInfo.membership.price, 10) * 12)), 0);
                } else if (d.dentistInfo.childMembership.id === cost.membershipId) {
                  d.dentistInfo.childMembership.fullCost = cost.fullCost;
                  d.dentistInfo.childMembership.savings = Math.max((cost.fullCost - (parseInt(d.dentistInfo.childMembership.price, 10) * 12)), 0);
                }
              });

              // Retrieve Active Member Count
              db.Subscription.count({
                where: {
                  dentistId: d.dentistInfo.id,
                  status: 'active',
                }
              }).then((activeMemberCount) => {
                d.dentistInfo.activeMemberCount = activeMemberCount;
                resolve(d);
              }).catch(reject);
            });
          }).catch(reject);
        }
      })
      .catch(reject);
    });
  }
};
