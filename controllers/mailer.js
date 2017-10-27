// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import {
  EMAIL_SUBJECTS,
} from '../config/constants';

import db from '../models';

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
      subject: EMAIL_SUBJECTS.dentist.activation_required,
      site,
      user,
    });
  },
  /**
   * Sends an email to the user about account manager activating their account
   *
   * @param {object} res - the express response
   * @param {object} user - the user object
   * @return {Promise<Info>}
   */
  thanksForSignupEmail(res, user) {
    return mail(res.mailer, 'auth/dentist/thanks_for_signup', {
      to: user.email,
      subject: EMAIL_SUBJECTS.dentist.welcome,
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
  },
  async clientWelcomeEmail(res, user, usersSubscription, dentistPlans) {

    const dentistContactInfoQuery = await db.User.findOne({
      where: {
        id: usersSubscription[0].dentistId
      },
      include: [{
        model: db.DentistInfo,
        as: 'dentistInfo'
      }]
    });

    const dentistContactInfo = constructDentistInfo(dentistContactInfoQuery);
    const paymentDetails = constructPaymentDetails(usersSubscription, dentistPlans);

    return mail(res.mailer, 'auth/client/welcome', {
      to: user.email,
      subject: EMAIL_SUBJECTS.client.welcome,
      site,
      user,
      officeName: dentistContactInfoQuery.dentistInfo.officeName,
      dentistContactInfo,
      paymentDetails
    });
  },
  dentistReviewNotification(res, user, patient, review) {
    return mail(res.mailer, 'dentists/new_review', {
      to: user.email,
      subject: EMAIL_SUBJECTS.dentist.new_review,
      site,
      patient,
      review
    });
  }
  // TODO: add all mailer calls here from endpoints

};

function constructDentistInfo(dentist) {
  const { dentistInfo } = dentist;
  return `
    Dentist Name: ${dentist.firstName + dentist.lastName},
    Office Name: ${dentistInfo.officeName},
    Dentist Email: ${dentist.email},
    Dentist Office Email: ${dentistInfo.email},
    Office Address: ${dentistInfo.address || ''}, ${dentistInfo.city || ''}, ${dentistInfo.zipCode || ''}, ${dentistInfo.state || ''}\n
  `.replace(/  /g,'');
}

function constructPaymentDetails(subs, plans) {
  let total = plans.reduce((acc,p) => {
    subs.forEach(s => {
      if (s.membershipId == p.id) {
        acc += parseFloat(p.price);
      }
    });
    return acc;
  },0);

  return `
    Total Family Members Subscribed: ${subs.length},
    Subtotal: ${String(total)}.00 $
  `.replace(/  /g,'');
}
