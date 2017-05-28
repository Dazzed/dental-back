/* eslint max-len: 0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import Stripe from 'stripe';
import db from '../models';

const stripe = Stripe(process.env.STRIPE_API_KEY);

// ────────────────────────────────────────────────────────────────────────────────
// METHOD

/**
 * Creates a unique plan name
 *
 * @param {string} officeName - the name of the dentist office
 * @param {string} name - the name of the plan
 * @returns {string} - the unique plan name
 */
function createPlanID(officeName, name) {
  return `${officeName.split('').join('-')}__${name}`;
}

/**
 * Creates a more verbose error message from Stripe
 *
 * @param {object} err - the stripe error object
 * @returns {string} - the verbose message
 */
function verboseError(err) {
  switch (err.type) {
    case 'StripeCardError':
      // A declined card error
      err.message = 'The provided card was invalid';
      break;
    case 'RateLimitError':
      // Too many requests made to the API too quickly
      err.message = 'Too many requests have been made to our payments platform';
      break;
    case 'StripeInvalidRequestError':
      // Invalid parameters were supplied to Stripe's API
      err.message = 'The server has sent invalid parameters throught the payment portal';
      break;
    case 'StripeAPIError':
      // An error occurred internally with Stripe's API
      err.message = 'The payment platform experienced an internal error';
      break;
    case 'StripeConnectionError':
      // Some kind of error occurred during the HTTPS communication
      err.message = 'There was an issue connecting to the payment portal';
      break;
    case 'StripeAuthenticationError':
      // You probably used an incorrect API key
      err.message = 'There was an issue authorizing the connection to the payment portal';
      break;
    default:
      // Handle any other types of unexpected errors
      err.message = 'There was an unknown error';
      break;
  }

  return err.message;
}

export default {

  /**
   * Creates a new customer profile on Stripe
   *
   * @param {string} email - the user's email address
   * @returns {Promise<Customer>}
   */
  createCustomer(email) {
    return new Promise((resolve, reject) => {
      stripe.customers.create({
        email,
        description: `Primary Account Holder: ${email}`,
      }, (err, customer) => {
        if (err) reject(verboseError(err));
        resolve(customer);
      });
    });
  },

  /**
   * Deletes a customer profile on Stripe
   *
   * @param {string} custId - the stripe customer id
   * @returns {Promise<Confirmation>}
   */
  deleteCustomer(custId) {
    return new Promise((resolve, reject) => {
      stripe.customers.del(custId, (err, confirm) => {
        if (err) reject(verboseError(err));
        resolve(confirm);
      });
    });
  },

  /**
   * Gets details about the customer from Stripe
   *
   * @param {string} customerId - the stripe customer id
   * @returns {Promise<Customer>}
   */
  getCustomer(customerId) {
    return new Promise((resolve, reject) => {
      stripe.customers.retrieve(
        customerId,
        (err, customer) => {
          if (err) reject(verboseError(err));
          resolve(customer);
        }
      );
    });
  },

  /**
   * Issues a new charge against the customer
   *
   * @param {number} amount - the amount to charge
   * @param {string} chargeToken - the stripe generated charge token
   * @param {string} description - the description of the charge
   * @returns {Promise<Charge>}
   */
  issueCharge(amount, chargeToken, description) {
    return new Promise((resolve, reject) => {
      stripe.charges.create({
        amount,
        description,
        currency: 'usd',
        source: chargeToken, // obtained with Stripe.js
      }, (err, charge) => {
        if (err) reject(verboseError(err));
        resolve(charge);
      });
    });
  },

  /**
   * Creates a new membership plan on Stripe
   *
   * @param {string} officeName - the name of the office creating the membership
   * @param {string} name - the name of the membership plan
   * @param {number} [price=0] - the price of the plan
   * @param {string} [interval='month'] - the interval of how often the plan will be charged
   * @param {number} [trialPeriodDays=0] - the number of days for which the subscriber will not be billed
   * @returns {Promise<Plan>}
   */
  createMembershipPlan(officeName, name, price = 0, interval = 'month', trialPeriodDays = 0) {
    const id = createPlanID(officeName, name);

    return new Promise((resolve, reject) => {
      stripe.plans.create({
        id,
        interval,
        name,
        amount: price,
        currency: 'usd',
        interval_count: 1,
        trial_period_days: trialPeriodDays,
      }, (err, plan) => {
        if (err) reject(verboseError(err));
        resolve(plan);
      });
    });
  },

  /**
   * Gets details for a specific membership plan
   *
   * @param {string} officeName - the name of the office creating the membership
   * @param {string} name - the name of the membership plan
   * @returns {Promise<Plan>}
   */
  getMembershipPlan(officeName, name) {
    const id = createPlanID(officeName, name);

    return new Promise((resolve, reject) => {
      stripe.plans.retrieve(id,
        (err, plan) => {
          if (err) reject(verboseError(err));
          resolve(plan);
        }
      );
    });
  },

  /**
   * Deletes an existing membership plan
   *
   * @param {string} officeName - the name of the office creating the membership
   * @param {string} name - the name of the membership plan
   * @returns {Promise<Confirmation>}
   */
  deleteMembershipPlan(officeName, name) {
    const id = createPlanID(officeName, name);

    return new Promise((resolve, reject) => {
      stripe.plans.del(id,
        (err, confirmation) => {
          if (err) reject(verboseError(err));
          // Create the new plan
          resolve(confirmation);
        }
      );
    });
  },

  /**
   * Updates the price of the membership plan but related recycles stripe subscriptions
   *
   * @param {any} membershipId - the id of the membership record
   * @param {string} officeName - the name of the office creating the membership
   * @param {string} name - the name of the membership plan
   * @param {number} [price=0] - the price of the plan
   * @param {string} [interval='month'] - the interval of how often the plan will be charged
   * @param {number} [trialPeriodDays=0] - the number of days for which the subscriber will not be billed
   * @returns {Promise<null>}
   */
  updateMembershipPlanPrice(membershipId, officeName, name, price = 0, interval = 'month', trialPeriodDays = 0) {
    return new Promise((resolve, reject) => {
      // Delete the old plan
      this.deleteMembershipPlan(officeName, name)
      // Create the new plan
      .then(() => this.createMembershipPlan(officeName, name, price, interval, trialPeriodDays))
      .then((plan) => {
        // Update related subscriptions
        db.Subscription.findAll({
          where: { membershipId },
          attributes: ['stripeSubscriptionId'],
        }).then((subscriptions) => {
          subscriptions.forEach(sub =>
            // Update the old subscriptions with the new plan
            stripe.subscriptions.update(
              sub.stripeSubscriptionId,
              { plan, prorate: true, },
              (err, s) => {
                if (!err) {
                  sub.stripeSubscriptionId = s.id;
                  sub.save();
                }
              }
            )
          );
          resolve();
        });
      })
      .catch(reject);
    });
  },

  /**
   * Creates a new subscription
   *
   * @param {string} officeName - the name of the office creating the membership
   * @param {string} name - the name of the membership plan
   * @param {string} customerId - the id of the customer to subscribe
   * @returns {Promise<Subscription>}
   */
  createSubscription(officeName, name, customerId) {
    const id = createPlanID(officeName, name);

    return new Promise((resolve, reject) => {
      stripe.subscriptions.create({
        customer: customerId,
        plan: id,
      }, (err, subscription) => {
        if (err) reject(verboseError(err));
        resolve(subscription);
      });
    });
  },

  /**
   * Gets details for a subscription record
   *
   * @param {string} subscriptionId - the stripe subscription id
   * @returns {Promise<Subscription>}
   */
  getSubscription(subscriptionId) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.retrieve(
        subscriptionId,
        (err, subscription) => {
          if (err) reject(verboseError(err));
          resolve(subscription);
        }
      );
    });
  },

  /**
   * The id of the subscription record to remove
   *
   * @param {string} subscriptionId - the stripe subscription id
   * @returns {Promise<Confirmation>}
   */
  cancelSubscription(subscriptionId) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.del(
        subscriptionId,
        (err, confirmation) => {
          if (err) reject(verboseError(err));
          resolve(confirmation);
        }
      );
    });
  }

};
