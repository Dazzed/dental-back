import { Router } from 'express';
import passport from 'passport';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';

import {
  NORMAL_USER_EDIT,
  DENTIST_USER_EDIT,
  FAMILY_MEMBER,
} from '../../utils/schema-validators';

import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../errors';


const router = new Router();


function getUserFromParam(req, res, next, userId) {
  if (userId === 'me') {
    return next();
  }

  return db.User.getActiveUser(userId).then((user) => {
    if (!user) {
      return next(new NotFoundError());
    }

    req.locals.user = user;  // eslint-disable-line no-param-reassign
    return next();
  }).catch((error) => {
    next(error);
  });
}


function getFamilyMemberFromParam(req, res, next, memberId) {
  return db.FamilyMember.findById(memberId).then((member) => {
    if (!member) {
      return next(new NotFoundError());
    }

    req.locals.familyMember = member;  // eslint-disable-line no-param-reassign
    return next();
  }).catch((error) => {
    next(error);
  });
}


function checkUserPermission(req, res, next) {
  const user = req.params.userId === 'me' ? req.user : req.locals.user;
  const hasPermission =
    user.get('id') === req.user.get('id') || req.user.get('type') === 'admin';

  if (!hasPermission) {
    return next(new ForbiddenError());
  }

  req.locals.user = user;  // eslint-disable-line no-param-reassign

  return next();
}


function checkFamilyMemberPermission(req, res, next) {
  const user = req.params.userId === 'me' ? req.user : req.locals.user;
  let hasPermission =
    user.get('id') === req.user.get('id') &&
    user.get('id') === req.locals.familyMember.get('userId');

  hasPermission |= req.user.get('type') === 'admin';

  if (!hasPermission) {
    return next(new ForbiddenError());
  }

  return next();
}


function getUser(req, res) {
  return res.json({
    data: req.locals.user.toJSON(),
  });
}


function deleteUser(req, res) {
  req.locals.user.update({ isDeleted: true }).then(() => res.json());
}


// TODO: maybe later add avatar support?? or another endpoint
function updateUser(req, res, next) {
  const validator = Object.assign({}, req.locals.user.type === 'client' ?
    NORMAL_USER_EDIT : DENTIST_USER_EDIT);

  if (req.locals.user.get('email') === req.body.email) {
    delete validator.email.isDBUnique;
  }

  if (req.locals.user.get('specialtyId') === req.body.specialtyId
    && validator.specialtyId) {
    delete validator.specialtyId.existsInDB;
  }

  req.checkBody(validator);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const body = _.omit(req.body, EXCLUDE_FIELDS_LIST);

      // NOTE: This should later removed to add and remove by others endpoints
      const phone = req.locals.user.get('phoneNumbers')[0];
      const address = req.locals.user.get('addresses')[0];

      phone.set('number', req.body.phone);
      address.set('value', req.body.address);

      return Promise.all([
        req.locals.user.update(body),
        phone.save(),
        address.save(),
      ]);
    })
    .then(() => db.User.getActiveUser(req.locals.user.get('id')))
    .then((user) => {
      res
        .status(HTTPStatus.OK)
        .json({ data: user.toJSON() });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


function getFamilyMembers(req, res) {
  req.locals.user.getFamilyMembers({ raw: true }).then((members) => {
    res.json({ data: members });
  });
}


function getFamilyMember(req, res) {
  res.json({ data: req.locals.familyMember.toJSON() });
}


// TODO: add avatar feature
function addFamilyMember(req, res, next) {
  req.checkBody(FAMILY_MEMBER);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body,
    ['email', 'firstName', 'lastName', 'phone', 'birthDate', 'familyRelationship']);

  return req.locals.user.createFamilyMember(data).then((member) => {
    res.json({ data: member.toJSON() });
  });
}


function updateFamilyMember(req, res, next) {
  req.checkBody(FAMILY_MEMBER);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body,
    ['email', 'firstName', 'lastName', 'phone', 'birthDate', 'familyRelationship']);

  return req.locals.familyMember.update(data).then((member) => {
    res.json({ data: member.toJSON() });
  });
}


function deleteFamilyMember(req, res) {
  req.locals.familyMember.destroy().then(() => res.json());
}


// Bind to routes

router.param('userId', getUserFromParam);
router.param('familyMemberId', getFamilyMemberFromParam);


router
  .route('/:userId')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkUserPermission,
    getUser)
  .delete(
    passport.authenticate('jwt', { session: false }),
    checkUserPermission,
    deleteUser)
  .put(
    passport.authenticate('jwt', { session: false }),
    checkUserPermission,
    updateUser);


router
  .route('/:userId/family-members')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkUserPermission,
    getFamilyMembers)
  .post(
    passport.authenticate('jwt', { session: false }),
    checkUserPermission,
    addFamilyMember);


router
  .route('/:userId/family-members/:familyMemberId')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkFamilyMemberPermission,
    getFamilyMember)
  .put(
    passport.authenticate('jwt', { session: false }),
    checkFamilyMemberPermission,
    updateFamilyMember)
  .delete(
    passport.authenticate('jwt', { session: false }),
    checkFamilyMemberPermission,
    deleteFamilyMember);


export default router;
