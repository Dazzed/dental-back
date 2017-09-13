import { Router } from 'express';
import db from '../../models';
import googleMapsClient from '../../services/google_map_api';

async function search(req, res) {
  console.log(req.body);
  res.json(req.body);
}

const router = new Router({ mergeParams: true });

router.route('/')
  .post(search)
export default router;
