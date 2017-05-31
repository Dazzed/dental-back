// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import db from '../models';

import stripe from '../controllers/stripe';

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {
  /**
   * Retrieves the plan costs from stripe
   *
   * @return {Promise<object>}
   */
  getPlanCosts() {
    return new Promise((resolve, reject) => {
      stripe.getMembershipPlan(this.get('stripePlanId'))
      .then((plan) => {
        let monthlyPrice = (plan.interval === 'month' ? plan.amount : (plan.amount / 12));
        let annualPrice = (plan.interval === 'month' ? (plan.amount * 12) : plan.amount);
        const type = (plan.interval === 'month' ? 'monthly' : 'annual');

        // Convert to float
        monthlyPrice = monthlyPrice > 0 ? monthlyPrice / 100 : monthlyPrice;
        annualPrice = annualPrice > 0 ? annualPrice / 100 : annualPrice;

        resolve({
          monthlyPrice,
          annualPrice,
          type,
        });
      })
      .catch(reject);
    });
  }
};

/**
 * Methods related to providing additional information about Memberships
 */
export const MembershipMethods = {
  /**
   * Calculates the full cost of the membership
   *
   * @param {Number} dentistId - the id of the dentist who provides this membership
   * @param {Membership} membership - the membership to calculate against
   * @return {Array<[membershipId, fullCost]>}
   */
  calculateCosts(dentistInfoId, memberships) {
    return Promise.all(memberships.map(membershipId =>
      new Promise((resolve, reject) => {
        db.PriceCodes.findAll({
          include: [{
            model: db.MembershipItem,
            as: 'membershipItems',
            where: {
              dentistInfoId,
              membershipId,
            },
          }]
        }).then((priceCodes) => {
          priceCodes = priceCodes.reduce((obj, pc) => {
            obj[pc.code] = pc.membershipItems.shift().price || 0;
            return obj;
          }, {});

          // Calculate the full cost
          const fullCost =
            (priceCodes['1110'] * 2) +
            (priceCodes['0120'] * 2) +
             priceCodes['0274'] +
            (priceCodes['0330'] * 0.3) +
             priceCodes['0220'] +
             priceCodes['0140'] || 0;

          resolve({ membershipId, fullCost });
        }).catch(err => reject(err));
      }))
    );
  }
};
