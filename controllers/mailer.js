// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import {
  EMAIL_SUBJECTS,
} from '../config/constants';

// ────────────────────────────────────────────────────────────────────────────────
// MAILER

const site = process.env.SITE;

export default {

  /**
   * Sends an email to the user requesting activation
   *
   * @param {object} res - the express response
   * @param {object} user - the user object
   * @return {Promise<Info>}
   */
  activationRequestEmail(res, user) {
    return new Promise((resolve, reject) => {
      res.mailer.send('auth/dentist/activation_required', {
        to: user.email,
        subject: EMAIL_SUBJECTS.client.activation_required,
        site,
        user,
      }, (err, info) => {
        if (err) reject(err);
        resolve(info);
      });
    });
  },

  /**
   * Sends an email to the user of successful activation
   *
   * @param {object} res - the express response
   * @param {object} user - the user object
   * @return {Promise<Info>}
   */
  activationCompleteEmail(res, user) {
    return new Promise((resolve, reject) => {
      res.mailer.send('auth/activation_complete', {
        to: user.email,
        subject: EMAIL_SUBJECTS.activation_complete,
        site,
        user,
      }, (err, info) => {
        if (err) reject(err);
        resolve(info);
      });
    });
  }

  // TODO: add all mailer calls here from endpoints

};
