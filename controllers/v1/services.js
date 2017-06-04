import { Router } from 'express';

import db from '../../models';


const router = new Router({ mergeParams: true });


function getServices(req, res, next) {
  return db.Service.findAll({ raw: true, orderBy: 'createdAt' })
    .then((services) =>
      res.json({ data: services || [] })
    ).catch((error) => {
      next(error);
    });
}


router
  .route('/')
  .get(getServices);


export default router;

