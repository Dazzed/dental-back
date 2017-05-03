import { Router } from 'express';

import { auth } from './auth';
import users from './users';
import memberships from './memberships';
import members from './members';
import services from './services';
import dentistSpecialties from './dentist-specialties';
import messages from './messages';
import { dentists } from './dentists';
import userDentist from './user-dentist';
import offices from './offices';
import pricing from './pricing';
import reviews from './reviews';

// just one to one resources
import dentistInfo from './dentist-info';

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);

router.use('/users', users);
router.use('/users/:userId/members', members);
router.use('/users/:userId/memberships', memberships);
router.use('/users/:userId/messages', messages);
router.use('/users/:userId', userDentist);
router.use('/dentists/:dentistId/reviews', reviews);
router.use('/dentists', dentists);

// just one to one resources
router.use('/users/:userId/dentist-info', dentistInfo);

router.use('/dentist-specialties', dentistSpecialties);

// root maybe for admin calls? add adminRequired middleware
// Maybe also add express validators to request type user
router.use('/members', members);
router.use('/memberships', memberships);
router.use('/services', services);
router.use('/offices', offices);
router.use('/pricing', pricing);

export default router;
