// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';
import HTTPStatus from 'http-status';
import moment from 'moment';
import isPlainObject from 'is-plain-object';

import db from '../../models';
import { checkUserDentistPermission } from '../../utils/permissions';

import {
  MEMBER,
  ADD_MEMBER,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  UnauthorizedError,
} from '../errors';

import {
  userRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

import {
  subscribeNewMember,
} from '../../utils/subscribe';
// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of member records
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getInvoices(req, res, next) {
  console.log(`params userID: ${req.params.userId}, local userID: ${req.user.get('id')}`);
  let userId = req.params.userId;

  if (parseInt(req.params.userId) !== req.user.get('id')) {
    throw new UnauthorizedError();
  }

  // return stripe example response for now
  return res.json({
    "object": "list",
    "data": [
      {
        "id": "sub_BFs3VtYuXykKIa",
        "object": "line_item",
        "amount": 1500,
        "currency": "usd",
        "description": null,
        "discountable": true,
        "livemode": false,
        "metadata": {},
        "period": {
          "start": 1503346562,
          "end": 1506024962
        },
        "plan": {
          "id": "1__default-monthly-child-membership__631ef82e-8529-411d-adeb-9f66e4f52e0a",
          "object": "plan",
          "amount": 1500,
          "created": 1503329705,
          "currency": "usd",
          "interval": "month",
          "interval_count": 1,
          "livemode": false,
          "metadata": {},
          "name": "1__default-monthly-child-membership__631ef82e-8529-411d-adeb-9f66e4f52e0a",
          "statement_descriptor": null,
          "trial_period_days": null
        },
        "proration": false,
        "quantity": 1,
        "subscription": null,
        "subscription_item": "si_1AtMJaJW39IQVtC9GoJWdYkG",
        "type": "subscription"
      }
    ],
    "has_more": false,
    "url": "/v1/invoices/in_1AtMJaJW39IQVtC9nqCj3A8V/lines"
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    getInvoices);

export default router;
