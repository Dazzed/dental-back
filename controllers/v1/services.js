// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

import {
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist services
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getServices(req, res, next) {
  return db.Service.findAll({ orderBy: 'createdAt', attributes: ['id', 'name'] })
    .then(services => res.json({ data: services || [] }))
    .catch(err => next(new BadRequestError(err)));
}

async function addService(req, res) {
  try {
    const { service } = req.body;
    const isExistingService = await db.Service.find({
      where: {
        name: service.name.trim(),
      }
    });
    if (isExistingService) {
      return res.status(400).send({ errors: 'Service is Already Existing' });
    }
    const addedService = await db.Service.create({
      name: service.name
    });

    return res.status(200).send({ valid: true, service: addedService });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: "Internal Server error" });
  }
}

async function deleteService(req, res) {
  const { service } = req.body;
  const isExistingService = await db.Service.find({
    where: {
      name: service.name
    }
  });
  if (!isExistingService) {
    return res.status(400).send({ errors: 'Service does not exist' });
  }
  await db.Service.destroy({
    where: {
      id: service.id,
    }
  });

  return res.status(200).send({ valid: true, service });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getServices)
  .post(addService)
  .delete(deleteService);

export default router;
