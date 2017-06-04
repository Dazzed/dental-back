import { Router } from 'express';
import _ from 'lodash';

import db from '../../models';


const router = new Router({ mergeParams: true });


function getDentistSpecialties(req, res, next) {
  return db.DentistSpecialty.findAll({ raw: true }).then((specialties) =>
    res.json({ data: specialties || [] })
  ).catch((error) => {
    next(error);
  });
}


router
  .route('/')
  .get(getDentistSpecialties);


export default router;

