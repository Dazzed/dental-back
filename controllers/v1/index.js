import { Router } from 'express';

import auth from './auth';
import users from './users';

const router = new Router({ mergeParams: true });

router.use('/accounts', auth);
router.use('/users', users);


export default router;
