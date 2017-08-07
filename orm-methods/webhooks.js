import db from '../models';
import { getTransactionDetails } from '../controllers/payments';

const SUCCESS = 1;
const DECLINED = 2;
const ERROR = 3;
const IN_REVIEW = 4;

/**
 * Methods related to assisting webhook events
 */
export const WebhookMethods = {
  /**
   * Saves a new refund record in the database
   *
   * @param {Object} payload - the webhook payload from Authorize.net
   * @returns Promise
   */
  trackRefund(payload) {
    return new Promise((resolve, reject) => {
      if (payload.responseCode === SUCCESS) {
        // 1. Grab the transaction from Authorize.net
        getTransactionDetails(payload.id).then(details => {
          // 2. Find the associated user by authorizeId
          db.Users.find({
            where: { authorizeId: details.authorizeId }
          }).then(user => {
            if (user) {
              db.Refunds.create({
                transId: payload.id,
                userId: user.id,
                amount: payload.authAmount,
              })
              .then(resp => resolve(resp))
              .reject(err => reject(err));
            } else {
              resolve();
            }
          });
        }).catch(err => {
          reject(err);
        });
      } else {
        // Do not process a failed refund
        resolve(true);
      }
    });
  },

  /**
   * Updates a users Dental subscription state
   *
   * @param {Object} payload - the webhook payload from Authorize.net
   */
  updateSubscription(payload) {
    // 1. Locate the associated subscription record using `payload.id === subscriptionId`
    // db.Subscription.find({
    //   where: {},
    // });
    // 2. Update the subscription status and amount
  },

  /**
   * Updates a users payment profile
   *
   * @param {Object} payload - the webhook payload from Authorize.net
   */
  updatePaymentProfile(payload) {
    // 1. Update the user record's paymentId located by authorizeId === payload.customerProfileId
  }
};
