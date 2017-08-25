import { Router } from 'express';
import HTTPStatus from 'http-status';
import db from '../../models';

import {
  BadRequestError,
} from '../errors';

import {
  userRequired,
  injectMemberFromUser,
  validateBody,
} from '../middlewares';

import {
  MANAGER_REGISTRATION,
  MANAGER_UPDATE
} from '../../utils/schema-validators';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'verified', 'updatedAt'];

async function addManager(req, res) {
  try {
    const data = req.body;

    const manager = await db.User.create({
      ...data,
      type: 'manager'
    });
    const phone = await db.Phone.create({
      number: data.phone,
      userId: manager.id
    });
    const addedManager = await db.User.find({
      where: { id: manager.id },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers'
      }],
      attributes: {
        exclude: userFieldsExcluded
      }
    });
    return res.status(200).send(addedManager);
  } catch (e) {
    console.log(e);
    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send({});
  }
}

async function editManager(req, res) {
  try {
    const data = req.body;

    const manager = await db.User.find({ 
      where: { id: data.id },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers'
      }],
     });

    if (!manager) {
      return res.status(400).send({ errors: 'Invalid Manager' });
    } else if (data.email !== manager.email) {
      const isEmailAlreadyInUse = await db.User.find({ where: { email: data.email } });
      if (isEmailAlreadyInUse) {
        return res.status(400).send({ errors: 'Email is Already in use.' });
      }
    }

    const editedManager = await db.User.update({
      ...data
    },{
      where: {
        id: data.id
      }
    });

    if (data.phone !== manager.phoneNumbers[0].number) {
      await db.Phone.update({
        number: data.phone
      },{
        where: {
          userId: data.id
        }
      });
    }

    const addedManager = await db.User.find({
      where: { id: manager.id },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers'
      }],
      attributes: {
        exclude: userFieldsExcluded
      }
    });
    return res.status(200).send(addedManager);
  } catch (e) {
    console.log(e);
    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send({});
  }
}

async function getManagersList(req, res) {
  try {
    const managers = await db.User.findAll({
      where: {
        type: 'manager'
      },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers'
      }],
      attributes: {
        exclude: userFieldsExcluded
      }
    });
    return res.status(200).send(managers);
  } catch (e) {
    console.log(e);
    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send({});
  }
}

const router = new Router({ mergeParams: true });

router
  .route('/')
  .post(validateBody(MANAGER_REGISTRATION), addManager)
  .patch(validateBody(MANAGER_UPDATE), editManager);

router
  .route('/list')
  .get(getManagersList);

export default router;
