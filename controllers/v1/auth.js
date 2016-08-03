import { Router } from 'express';

const router = new Router();


router
  .route('/login')
  .post((req, res) => {
    const user = {
      name: req.body.name
    };

    req.session.user = user;  // eslint-disable-line no-param-reassign
    res.json({});
  });


export default router;
