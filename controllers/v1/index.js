import { Router } from 'express';

import { userRequired, adminRequired } from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER COMPONENTS

import auth from './auth';
import dentists from './dentists';
import dentistMembers from './dentist-members';
import dentistSpecialties from './dentist-specialties';
import dentistInfo from './dentist-info';
import members from './members';
import memberships from './memberships';
import messages from './messages';
import notifications from './notifications';
import offices from './offices';
import pricing from './pricing';
import reports from './reports';
import reviews from './reviews';
import services from './services';
import stats from './stats';
import userDentist from './user-dentist';
import users from './users';

// ────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);

// ────────────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS

router.use('/users', users);
router.use('/users/:userId', userDentist);
router.use('/users/:userId/dentist-info', dentistInfo);
router.use('/users/:userId/members', members);
router.use('/users/:userId/memberships', memberships);
router.use('/users/:userId/messages', messages);
router.use('/users/:userId/notifications', notifications);

// ────────────────────────────────────────────────────────────────────────────────
// DENTIST ENDPOINTS

// FIXME: Need to break apart the `dentists` routes so as
// to not interfere with other dentist endpoints
router.use('/dentists', dentists);
router.use('/dentists/:dentistId/reviews', reviews);
router.use('/dentists/:dentistId/members', dentistMembers);

// ────────────────────────────────────────────────────────────────────────────────
// DENTIST SPECIALTIES

router.use('/dentist-specialties', dentistSpecialties);

// root maybe for admin calls? add adminRequired middleware
// Maybe also add express validators to request type user
router.use('/admin', userRequired, adminRequired);
router.use('/admin/stats', stats);
router.use('/admin/members', members);
router.use('/admin/memberships', memberships);
router.use('/admin/services', services);
router.use('/admin/offices', offices);
router.use('/admin/pricing', pricing);
router.use('/admin/reports', reports);

export default router;
