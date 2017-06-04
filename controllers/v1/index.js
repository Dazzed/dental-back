import { Router } from 'express';

import { userRequired, adminRequired, injectUser } from '../middlewares';
import { checkUserDentistPermission } from '../../utils/permissions';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER COMPONENTS

import auth from './auth';
import dentists from './dentists';
import myDentist from './my-dentist';
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
import users from './users';

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
router.use('/admin/members', members);
router.use('/admin/memberships', memberships);
router.use('/admin/reports', reports);

router.use('/admin/offices', offices);

export default router;
