import { Router } from 'express';
import HTTPStatus from 'http-status';
import _ from 'lodash';
import crypto from 'crypto';
import isPlainObject from 'is-plain-object';

import db from '../../models';


import {
  NORMAL_USER_REGISTRATION,
  DENTIST_USER_REGISTRATION,
} from '../../utils/schema-validators';

const router = new Router();


// Utils functions

function createAvatar(model, field) {
  if (field) {
    const data = `${field.filename}${new Date().toISOString()}`;
    const filename = crypto.createHash('md5').update(data).digest('hex');

    // TODO: send to S3

    model.avatar = {  // eslint-disable-line  no-param-reassign
      filename,
      filetype: field.filetype,
    };

    model.save();
  }
}

// Middlewares

function normalUserSignup(req, res, next) {
  req.checkBody(NORMAL_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = _.omit(req.body,
        ['avatar', 'phone', 'address', 'familyMembers']);

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (err, createdUser) => {
          if (err) {
            reject(err);
          } else {
            createAvatar(createdUser, req.body.avatar);
            resolve(createdUser);
          }
        });
      });
    })
    .then((user) => {
      const query = [];
      query.push(user.createPhoneNumber({ number: req.body.phone }));
      query.push(user.createAddress({ value: req.body.address }));

      if (req.body.familyMembers) {
        req.body.familyMembers.forEach((member) => {
          query.push(user.createFamilyMember(member).then((createdMember) =>
              createAvatar(createdMember, member.avatar))
          );
        });
      }

      return Promise.all(query);
    })
    .then(() => {
      res
        .status(HTTPStatus.CREATED)
        .json({});
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }

      return next(errors);
    });
}

function dentistUserSignup(req, res, next) {
  req.checkBody(DENTIST_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = _.omit(req.body, ['phone', 'address']);
      user.type = 'dentist';

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (err, createdUser) => {
          if (err) {
            reject(err);
          } else {
            resolve(createdUser);
          }
        });
      });
    })
    .then((user) => {
      const query = [];
      query.push(user.createPhoneNumber({ number: req.body.phone }));
      query.push(user.createAddress({ value: req.body.address }));
      return Promise.all(query);
    })
    .then(() => {
      res
        .status(HTTPStatus.CREATED)
        .json({});
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }

      return next(errors);
    });
}


// Bind with routes
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


router
  .route('/signup')
  .post(normalUserSignup);


router
  .route('/dentist-signup')
  .post(dentistUserSignup);

export default router;
