import { Router } from 'express';

import db from '../../models';
import { userRequired, adminRequired, validateHook, trackHookEvent } from '../middlewares';

const NAME = process.env.AUTHORIZE_NAME;
const KEY = process.env.AUTHORIZE_KEY;
const authKey = new Buffer(`${NAME}:${KEY}`).toString('base64');

const router = new Router({ mergeParams: true });

// ────────────────────────────────────────────────────────────────────────────────
// HANDLERS



// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

// router.route('/')
//   .post(userRequired, adminRequired, saveHook)
//   .delete(userRequired, adminRequired, deleteHook);

export default router;
