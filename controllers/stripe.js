/* eslint max-len: 0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import Stripe from 'stripe';
import db from '../models';
import uuid from 'uuid/v4';
import _ from 'lodash';

import {notifyMembershipPriceUpdateAdvance} from '../jobs/member_ship_fee_notification';

let stripe;
if (process.env.NODE_ENV === 'test') {
  stripe = Stripe(process.env.STRIPE_API_KEY_STAGING);
} else if (process.env.NODE_ENV === 'test_production') {
  stripe = Stripe(process.env.STRIPE_API_KEY_TEST_PROD);
} else {
  stripe = Stripe(process.env.STRIPE_API_KEY);
}

// ────────────────────────────────────────────────────────────────────────────────
// METHOD

/**
 * Creates a more verbose error message from Stripe
 *
 * @param {object} err - the stripe error object
 * @returns {string} - the verbose message
 */
function verboseError(err) {
  console.error(err);
  switch (err.type) {
    case 'StripeCardError':
      // A declined card error
      // Leave Stripe's existing message, since it provides helpful information
      // for users to correct the error on the checkout form.
      break;
    case 'RateLimitError':
      // Too many requests made to the API too quickly
      err.message = 'Too many requests have been made to our payments platform.';
      break;
    case 'StripeInvalidRequestError':
      // Invalid parameters were supplied to Stripe's API
      err.message = 'The server has sent invalid parameters through the payment portal.';
      break;
    case 'StripeAPIError':
      // An error occurred internally with Stripe's API
      err.message = 'The payment platform experienced an internal error.';
      break;
    case 'StripeConnectionError':
      // Some kind of error occurred during the HTTPS communication
      err.message = 'There was an issue connecting to the payment portal.';
      break;
    case 'StripeAuthenticationError':
      // You probably used an incorrect API key
      err.message = 'There was an issue authorizing the connection to the payment portal.';
      break;
    default:
      // Handle any other types of unexpected errors
      err.message = 'There was an unknown error.';
      break;
  }

  return err.message;
}

export default {
  stripeApi: stripe,
  /**
   * Creates a unique id
   *
   * @param {string} officeName - the name of the dentist office
   * @param {string} name - the name of the plan
   * @returns {string} - the unique plan name
   */
  createUniqueID(officeName, name) {
    return `${officeName}__${name.split(' ').join('-')}__${uuid()}`;
  },

  /**
   * Creates a new customer profile on Stripe
   *
   * @param {string} email - the user's email address
   * @returns {Promise<Customer>}
   */
  createCustomer(email, stripeToken) {
    let create_obj = {};
    if (stripeToken) {
      create_obj = {
        email,
        description: `Primary Account Holder: ${email}`,
        source: stripeToken
      }  
    } else {
      create_obj = {
        email,
        description: `Primary Account Holder: ${email}`,
      };
    }
    return new Promise((resolve, reject) => {
      stripe.customers.create(create_obj, (err, customer) => {
        if (err) reject(verboseError(err));
        resolve(customer);
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
   * Updates a customer record from Stripe
   *
   * @param {string} customerId - the stripe customer id
   * @returns {Promise<Customer>}
   */
  updateCustomer(customerId, details) {
    return new Promise((resolve, reject) => {
      stripe.customers.update(customerId, details,
      (err, customer) => {
        if (err) reject(verboseError(err));
        resolve(customer);
      });
    });
  },

  /**
   * Gets the list of payment methods registered for the user account
   *
   * @param {string} customerId - the stripe customer id
   * @returns {Promise<Card[]>}
   */
  getPaymentMethods(customerId) {
    return new Promise((resolve, reject) => {
      stripe.customers.listCards(customerId,
      (err, response) => {
        if (err) reject(verboseError(err));
        resolve(response);
      });
    });
  },

  /**
   * Gets the details about a specfic payment source
   *
   * @param {string} customerId - the stripe customer id
   * @param {string} cardToken - the stripe card token
   * @returns {Promise<Card>}
   */
  getPaymentMethod(customerId, cardToken) {
    return new Promise((resolve, reject) => {
      stripe.customers.retrieveCard(
        customerId,
        cardToken,
      (err, card) => {
        if (err) reject(verboseError(err));
        resolve(card);
      });
    });
  },

  /**
   * Adds a new payment source to the stripe customer
   *
   * @param {string} customerId - the stripe customer id
   * @param {string} sourceToken - the stripe generated source token
   * @returns {Promise<Card>}
   */
  addPaymentSource(customerId, sourceToken) {
    return new Promise((resolve, reject) => {
      stripe.customers.createSource(
        customerId,
        { source: sourceToken },
      (err, card) => {
        if (err) reject(verboseError(err));
        resolve(card);
      });
    });
  },

  /**
   * Updates the customers default payment source
   *
   * @param {string} customerId - the stripe customer id
   * @param {string} sourceToken - the stripe generated source token
   * @returns {Promise<Customer>}
   */
  setDefaultPaymentSource(customerId, cardToken) {
    return new Promise((resolve, reject) => {
      stripe.customers.update(customerId, {
        default_source: cardToken
      }, (err, customer) => {
        if (err) reject(verboseError(err));
        resolve(customer);
      });
    });
  },

  /**
   * Deletes a payment source linked to a stripe customer
   *
   * @param {string} customerId - the stripe customer id
   * @param {string} cardToken - the stripe card token
   * @returns {Promise<Confirmation>}
   */
  deletePaymentSource(customerId, cardToken) {
    return new Promise((resolve, reject) => {
      stripe.customers.deleteCard(
        customerId,
        cardToken,
      (err, confirmation) => {
        if (err) reject(verboseError(err));
        resolve(confirmation);
      });
    });
  },

  /**
   * Issues a new charge against the customer
   *
   * @param {number} amount - the amount to charge
   * @param {string} customerId - the id of the customer
   * @param {string} description - the description of the charge
   * @returns {Promise<Charge>}
   */
  issueCharge(amount, customerId, description) {
    return new Promise((resolve, reject) => {
      stripe.charges.create({
        amount,
        description,
        currency: 'usd',
        customer: customerId,
      }, (err, charge) => {
        if (err) reject(verboseError(err));
        resolve(charge);
      });
    });
  },

  /**
   * Creates a new membership plan on Stripe
   *
   * @param {string} planId - the unique id of the plan
   * @param {string} name - the name of the plan
   * @param {number} [price=0] - the price of the plan
   * @param {string} [interval='month'] - the interval of how often the plan will be charged
   * @param {number} [trialPeriodDays=0] - the number of days for which the subscriber will not be billed
   * @returns {Promise<Plan>}
   */
  createMembershipPlan(planId, name, price, interval, trialPeriodDays = 0) {
    return new Promise((resolve, reject) => {
      stripe.plans.create({
        id: planId,
        interval,
        name: planId,
        amount: _.floor(_.toNumber(price)*100),
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
   * @param {string} planId - the unique id of the plan
   * @param {string} name - the name of the membership plan
   * @returns {Promise<Plan>}
   */
  getMembershipPlan(planId) {
    return new Promise((resolve, reject) => {
      stripe.plans.retrieve(planId,
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
   * @param {string} planId - the unique id of the plan
   * @returns {Promise<Confirmation>}
   */
  deleteMembershipPlan(planId) {
    return new Promise((resolve, reject) => {
      stripe.plans.del(planId,
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
   * @param {string} planId - the unique id of the plan
   * @param {string} name - the name of the plan
   * @param {number} [price=0] - the price of the plan
   * @param {string} [interval='month'] - the interval of how often the plan will be charged
   * @param {number} [trialPeriodDays=0] - the number of days for which the subscriber will not be billed
   * @returns {Promise<null>}
   */
  updateMembershipPlanPrice(membershipId, planId, name, price = 0, interval, trialPeriodDays = 0) {
    price = _.floor(_.toNumber(price)*100); // adjust pricing to stripe's requirement

    return new Promise((resolve, reject) => {
      db.MembershipUpdateRequest.create({
        membershipId,
        newPlanName: name,
        newPrice: price
      }).then(data => {
        resolve();
        db.Subscription.findAll({
          where: { membershipId }
        }).then((subscriptions = []) => {
          subscriptions.forEach(sub => {
            if(sub.status == "active") {
              notifyMembershipPriceUpdateAdvance(sub.clientId, name, price);
            }
          });
        })
      })
      .catch(reject)
    });
  },

  /**
   * Creates a new subscription
   *
   * @param {string} planId - the id of the stripe plan to subscribe to
   * @param {string} customerId - the id of the customer to subscribe
   * @param {number} discount - how much to discount the subscription for
   * @returns {Promise<Subscription>}
   */
  createSubscription(planId, customerId, discount = 0) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.create({
        customer: customerId,
        plan: planId,
        // INFO: Add the line below to give 100% off (applied on each invoice)
        // application_fee_percent: discount
      }, (err, subscription) => {
        if (err) {
          console.log(err);
          reject(verboseError(err));
        }
        resolve(subscription);
      });
    });
  },

  /**
   * Updates a user subscription
   *
   * @param {string} subscriptionId - the id of the subscription
   * @param {string} planId - the id of stripe plan to change to
   * @returns {Promise<Subscription>}
   */
  updateSubscription(subscriptionId, planId, prorate = true) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.update(
        subscriptionId,
        {
          plan: planId,
          prorate,
          // INFO: Add this property to give 100% off (applied on each invoice)
          // application_fee_percent: 100
        },
        (err, subscription) => {
          if (err) reject(verboseError(err));
          resolve(subscription);
        }
      );
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
   * Gets details for stripe Invoice record
   *
   * @param {string} invoiceId - the stripe subscription id
   * @returns {Promise<Invoice>}
   */
  getInvoice(invoiceId) {
    return new Promise((resolve, reject) => {
      stripe.invoices.retrieve(
        invoiceId,
        (err, invoice) => {
          if (err) reject(verboseError(err));
          resolve(invoice);
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
  },

  createSubscriptionItem(subscriptionItemObject) {
    return new Promise((resolve, reject) => {
      stripe.subscriptionItems.create(subscriptionItemObject, (err, subscription) => {
        if (err) {
          return reject(err);
        }
        return resolve(subscription);
      });
    });
  },

  getSubscriptionItem(id) {
    return new Promise((resolve, reject) => {
      stripe.subscriptionItems.retrieve(id, (err, item) => {
        if (err) {
          return reject(err);
        }
        return resolve(item);
      });
    });
  },

  createSubscriptionWithItems(subscriptionObject) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.create(subscriptionObject, (err, subscription) => {
        if (err) {
          return reject(err);
        }
        return resolve(subscription);
      });
    });
  },

  updateSubscriptionItem(subscriptionItemId, object) {
    return new Promise((resolve, reject) => {
      stripe.subscriptionItems.update(subscriptionItemId, object, (err, item) => {
        if (err) {
          return reject(err);
        }
        return resolve(item);
      });
    });
  },

  createInvoiceItem(object) {
    return new Promise((resolve, reject) => {
      stripe.invoiceItems.create(object, (err, invoiceItem) => {
        if (err) {
          return reject(err);
        }
        return resolve(invoiceItem);
      });
    });
  },

  deleteSubscription(id, options = {}) {
    return new Promise((resolve, reject) => {
      stripe.subscriptions.del(id, options, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },
  deleteSubscriptionItem(id, config) {
    return new Promise((resolve, reject) => {
      stripe.subscriptionItems.del(id, config, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },
  listCharges(customerId) {
    return new Promise((resolve, reject) => {
      stripe.charges.list({ customer: customerId }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  },

  createRefund(chargeId, amount) {
    return new Promise((resolve, reject) => {
      stripe.refunds.create({
        charge: chargeId,
        amount
      }, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(data);
      });
    });
  }

};
