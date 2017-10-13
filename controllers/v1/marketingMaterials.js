import { Router } from 'express';
import HTTPStatus from 'http-status';
import db from '../../models';

import {
  BadRequestError,
} from '../errors';

async function getMarketingMaterials(req, res) {
  const marketingMaterials = await db.MarketingCategory.findAll({
    include: [{
      model: db.MarketingMaterial,
      as: 'materials'
    }]
  });

  return res.status(200).json({ marketingMaterials });
}

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getMarketingMaterials)
  .post()
  .delete();

router
  .route('/category')
  .post()
  .delete();

export default router;
