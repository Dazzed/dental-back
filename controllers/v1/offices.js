import { Router } from 'express';
// import passport from 'passport';

import db from '../../models';


const router = new Router({ mergeParams: true });


function getOffices(req, res, next) {
  db.DentistInfo.findAll({
    attributes: ['officeName', 'id'],
    raw: true,
  })
  .then((offices) => { res.json({ data: offices }); })
  .catch(next);
}


router
  .route('/')
  .get(getOffices);

export default router;
