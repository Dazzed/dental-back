import { Router } from 'express';

import auth from './auth';
import users from './users';
import memberships from './memberships';
import familyMembers from './family-members';
import dentistSpecialties from './dentist-specialties';

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);

router.use('/users', users);
router.use('/users/:userId/family-members', familyMembers);
router.use('/users/:userId/memberships', memberships);

router.use('/dentist-specialties', dentistSpecialties);
// root maybe for admin calls? add adminRequired middleware
// Maybe also add express validators to request type user
router.use('/family-members', familyMembers);
router.use('/memberships', memberships);

export default router;
