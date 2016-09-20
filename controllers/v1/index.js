import { Router } from 'express';

import auth from './auth';
import users from './users';
import memberships from './memberships';
import familyMembers from './family-members';
import services from './services';
import dentistSpecialties from './dentist-specialties';

// just one to one resources
import dentistInfo from './dentist-info';

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);

router.use('/users', users);
router.use('/users/:userId/family-members', familyMembers);
router.use('/users/:userId/memberships', memberships);

// just one to one resources
router.use('/users/:userId/dentist-info', dentistInfo);

router.use('/dentist-specialties', dentistSpecialties);

// root maybe for admin calls? add adminRequired middleware
// Maybe also add express validators to request type user
router.use('/family-members', familyMembers);
router.use('/memberships', memberships);
router.use('/services', services);

export default router;
