import passport from 'passport';

import db from '../models';
import {
  sendTermsAndConditionsUpdatedEmail
} from '../controllers/sendgrid_mailer';

async function termsAndConditionsUpdateNotification() {
  const dentists = await db.User.findAll({
    where: {
      type: 'dentist',
      verified: true
    },
    attributes: ['firstName', 'email']
  }).map(u => u.toJSON());

  const customers = await db.User.findAll({
    where: {
      type: 'client',
      salt: {
        $ne: null
      },
      isDeleted: false
    },
    attributes: ['firstName', 'email']
  });

  const users = dentists.concat(customers);
  users.forEach((user) => {
    sendTermsAndConditionsUpdatedEmail(user.firstName, user.email);
  });
}

function isValidChangePasswordObject(req, res, next) {
  const {
    password,
    newPassword,
    confirmNewPassword
  } = req.body;
  if (!password || !newPassword || !confirmNewPassword) {
    return res.status(400).send({ errors: 'Missing params' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).send({ errors: 'Passwords do not match' });
  }
  next();
}

async function isCurrentPasswordValid(req, res, next) {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err || !user) {
      return res.status(400).send({ errors: 'Invalid Old Password' });
    }
    next();
  })(req, res, next);
}

export {
  termsAndConditionsUpdateNotification,
  isValidChangePasswordObject,
  isCurrentPasswordValid
};
