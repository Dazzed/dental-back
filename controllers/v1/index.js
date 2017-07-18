import { Router } from 'express';

import { userRequired, dentistRequired, adminRequired, injectUser } from '../middlewares';
import { checkUserDentistPermission } from '../../utils/permissions';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER COMPONENTS

import auth from './auth';
import dentists from './dentists';
import myDentist from './my-dentist';
import dentistMembers from './dentist-members';
import dentistMemberships from './dentist-memberships';
import dentistSpecialties from './dentist-specialties';
import dentistInfo from './dentist-info';
import members from './members';
import memberships from './memberships';
import messages from './messages';
import notifications from './notifications';
import offices from './offices';
import patients from './patients';
import pricing from './pricing';
import reports from './reports';
import reviews from './reviews';
import services from './services';
import stats from './stats';
import subscriptions from './subscriptions';
import users from './users';
import webhooks from './webhooks';

// ────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);

// ────────────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS

router.use('/users/:userId/account', userRequired, injectUser(), users);
router.use('/users/:userId/my-dentist', userRequired, checkUserDentistPermission, myDentist);
router.use('/users/:userId/dentist-info', dentistInfo);
router.use('/users/:userId/members', members);
router.use('/users/:userId/messages', messages);
router.use('/users/:userId/notifications', notifications);

// ────────────────────────────────────────────────────────────────────────────────
// DENTIST ENDPOINTS

// FIXME: Need to break apart the `/dentists` routes a bit
// more so as to not interfere with other dentist endpoints
router.use('/dentists', dentists);
router.use('/dentists/edit', dentistInfo);
router.use('/dentists/:dentistId/members', userRequired, dentistRequired, dentistMembers);
router.use('/dentists/:dentistId/memberships', userRequired, dentistRequired, dentistMemberships);
router.use('/dentists/:dentistId/reviews', reviews);
router.use('/dentists/:dentistId/subscription', userRequired, subscriptions);

// ────────────────────────────────────────────────────────────────────────────────
// DENTIST SPECIALTIES

router.use('/dentist-specialties', dentistSpecialties);

// ────────────────────────────────────────────────────────────────────────────────
// PRICING

router.use('/pricing', pricing);

// ────────────────────────────────────────────────────────────────────────────────
// SERVICES

router.use('/services', services);

// root maybe for admin calls? add adminRequired middleware
// Maybe also add express validators to request type user
router.use('/admin', userRequired, adminRequired);

router.use('/admin/stats', stats);
router.use('/admin/dentists/patients', patients);
router.use('/admin/dentists/memberships', memberships);
router.use('/admin/dentists/reports', reports);

router.use('/admin/dentists/offices', offices);

router.use('/webhooks', webhooks);
router.use('/reports', reports);


// fees waiving endpoints
router.use('/dentists/:dentistId/patients', userRequired, dentistRequired, patients);

export default router;
