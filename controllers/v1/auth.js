import { Router } from 'express';

const router = new Router();


// TODO: do local passport auth and send the users, do not use session here
router
  .route('/login')
  .post((req, res) => {
    res.json({ id: 'test' });
  });

router
  .route('/logout')
  .get((req, res) => {
    res.end();
  });

export default router;
