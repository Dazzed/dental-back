'use strict';

const fs = require('fs');
const path = require('path');
const rootDir = path.normalize(path.join(path.dirname(__dirname), '.'));
if (fs.existsSync(path.join(rootDir, '.env'))) {
  require('dotenv').config();
}

const _ = require('lodash');

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_API_KEY);

function getAllPlans() {
  return new Promise((resolve, reject) => {
    stripe.plans.list({}, (err, plans) => {
      if(err) {
        return reject(err);
      }
      return resolve(plans.data);
    });
  });
}

function deleteAllPlans() {
  return getAllPlans().then((plans) => {
    return Promise.all(_.each(plans, (plan) => {
      return new Promise((resolve, reject) => {
        stripe.plans.del(plan.id, (err, confirmation) => {
          if(err) {
            return reject(err);
          }
          if(!confirmation.deleted) {
            return reject('Confirmation not received for deleting plan id: ' + plan.id);
          }
          return resolve();
        });
      });
    }));
  });
}

function getAllSubscriptions() {
  return new Promise((resolve, reject) => {
    stripe.subscriptions.list({}, (err, subscriptions) => {
      if(err) {
        return reject(err);
      }
      return resolve(subscriptions.data);
    });
  });
}

function deleteAllSubscriptions() {
  return getAllSubscriptions().then((subscriptions) => {
    return Promise.all(_.each(subscriptions, (subscription) => {
      return new Promise((resolve, reject) => {
        stripe.subscriptions.del(subscription.id, (err, confirmation) => {
          if(err) {
            return reject(err);
          }
          if(!confirmation.deleted) {
            return reject('Confirmation not received for deleting subscription id: ' + subscription.id);
          }
          return resolve();
        });
      });
    }));
  });
}

function getAllCustomers() {
  return new Promise((resolve, reject) => {
    stripe.customers.list({}, (err, customers) => {
      if(err) {
        return reject(err);
      }
      return resolve(customers.data);
    });
  });
}

function deleteAllCustomers() {
  return getAllCustomers().then((customers) => {
    return Promise.all(_.each(customers, (customer) => {
      return new Promise((resolve, reject) => {
        stripe.customers.del(customer.id, (err, confirmation) => {
          if(err) {
            return reject(err);
          }
          if(!confirmation.deleted) {
            return reject('Confirmation not received for deleting customer id: ' + customer.id);
          }
          return resolve();
        });
      });
    }));
  });
}

return deleteAllSubscriptions()
.then(() => {
  return deleteAllPlans();
})
.then(() => {
  return deleteAllCustomers();
})
.catch((err) => {
  console.log(err);
});