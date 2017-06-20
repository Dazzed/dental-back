// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import {
  EMAIL_SUBJECTS,
} from '../config/constants';

// ────────────────────────────────────────────────────────────────────────────────
// MAILER

const site = process.env.SITE;

function mail(mailer, template, locals) {
  return new Promise((resolve, reject) => {
    mailer.send(template, locals, (err, info) => err ? reject(err) : resolve(info));
  });
}

export default {

  /**
   * Sends an email to the user requesting activation
   *
   * @param {object} res - the express response
   * @param {object} user - the user object
   * @return {Promise<Info>}
   */
  activationRequestEmail(res, user) {
    return mail(res.mailer, 'auth/dentist/activation_required', {
      to: user.email,
      subject: EMAIL_SUBJECTS.client.activation_required,
      site,
      user,
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
    return mail(res.mailer, 'auth/activation_complete', {
      to: user.email,
      subject: EMAIL_SUBJECTS.activation_complete,
      site,
      user,
    });
  },

  /**
   * Send an email to reset the users password.
   */
  passwordResetEmail(res, user, token) {
    return mail(res.mailer, 'auth/password_reset', {
      to: user.email,
      subject: EMAIL_SUBJECTS.password_reset,
      token,
      site,
      user,
    });
  },

  dentistSignupEmail(res, user) {
    return mail(res.mailer, 'auth/dentist_signup', {
      to: user.email,
      subject: EMAIL_SUBJECTS.dentist.welcome,
      site,
      user
    });
  }
  // TODO: add all mailer calls here from endpoints

};
