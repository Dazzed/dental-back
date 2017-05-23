// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import { WebhookMethods } from '../../orm-methods/webhooks';
import { AUTHORIZE_HOOK_EVENTS } from '../../config/constants';

// ────────────────────────────────────────────────────────────────────────────────
// HANDLERS

/**
 * Handles a Webhook payload from Authorize.net
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function handleAuthorizeHook(req, res) {
  let action;

  switch (req.body.eventType) {
    case AUTHORIZE_HOOK_EVENTS.REFUND_CREATED:
      action = WebhookMethods.trackRefund(req.body.payload);
      break;
    case AUTHORIZE_HOOK_EVENTS.SUBSCRIPTION_SUSPENDED:
    case AUTHORIZE_HOOK_EVENTS.SUBSCRIPTION_TERMINATED:
    case AUTHORIZE_HOOK_EVENTS.SUBSCRIPTION_CANCELLED:
      action = WebhookMethods.updateSubscription(req.body.payload);
      break;
    default:
      action = Promise.resolve();
      break;
  }

  action.then(details => {
    res.json(details);
  }).catch(err => {
    res.json(err);
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

const router = new Router({ mergeParams: true });

router.route('/authorize')
  .post(handleAuthorizeHook);

export default router;
