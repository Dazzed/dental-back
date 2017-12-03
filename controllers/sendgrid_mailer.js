/* eslint-disable camelcase */
/* eslint-disable no-use-before-define */

import {
  EMAIL_SUBJECTS,
} from '../config/constants';
import db from '../models';

const ejs = require('ejs');
const fs = require('fs');
const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
const sendgrid = require('sendgrid').mail;

const site = process.env.SITE;
const dentalhq_from_email = new sendgrid.Email('donotreply@dentalhq.com');

function sendMail(mail) {
  const request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  sg.API(request, (error, response) => {
    if (error) {
      console.log(error.response.body);
    } else {
      console.log(response.statusCode);
    }
  });
}

export function membershipPriceChangeNotificationAdvance(user, plan_name, price, officeName, officeInfo) {
  const templateString = fs.readFileSync('./views/notifications/membership_price_update_advance.ejs', 'utf-8');
  const template = ejs.compile(templateString);
  const priceS = price.toString();
  const from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  const to_email = new sendgrid.Email(user.email);
  const subject = EMAIL_SUBJECTS.client.membershipPriceUpdate;
  const content = new sendgrid.Content(
    'text/html', template({ user, plan_name, price: priceS, subject, officeName, dentistInfo: officeInfo })
  );
  const mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function membershipPriceChangeNotification(user, plan_name, price) {
  const templateString = fs.readFileSync('./views/notifications/membership_price_update.ejs', 'utf-8');

  const priceS = price.toString();
  const template = ejs.compile(templateString);

  const to_email = new sendgrid.Email(user.email);
  const subject = EMAIL_SUBJECTS.client.membershipPriceUpdate;
  const content = new sendgrid.Content(
    'text/html', template({ user, plan_name, price: priceS, subject })
  );
  const mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function subscriptionChargeFailedNotification(user, attempt_count, officeName) {
  const templateString = fs.readFileSync('./views/notifications/subscription_charge_failed.ejs', 'utf-8');
  const template = ejs.compile(templateString);
  const from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  const to_email = new sendgrid.Email(user.email);
  const subject = EMAIL_SUBJECTS.client.subscriptionChargeFailed;
  let days_late;
  attempt_count = Number(attempt_count);
  if (attempt_count === 1) {
    days_late = 1;
  } else if (attempt_count === 2) {
    days_late = 7;
  } else if (attempt_count === 3) {
    days_late = 14;
  } else {
    days_late = 21;
  }
  const content = new sendgrid.Content(
    'text/html', template({ user, days_late, subject })
  );
  const mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function subscriptionCancellationNotification(user, officeName) {
  const templateString = fs.readFileSync('./views/notifications/subscription_cancellation.ejs', 'utf-8');
  const template = ejs.compile(templateString);
  const from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  const to_email = new sendgrid.Email(user.email);
  const subject = EMAIL_SUBJECTS.client.subscriptionCancellation;
  const content = new sendgrid.Content(
    'text/html', template({ user, subject })
  );
  const mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function annualPlanRenewAdvanceNotificationEmail(firstName, email, days_left_to_renew) {
  const templateString = fs.readFileSync('./views/notifications/annual_plan_renew_advance_notification.ejs', 'utf-8');
  const template = ejs.compile(templateString);

  const to_email = new sendgrid.Email(email);
  const subject = EMAIL_SUBJECTS.client.annualPlanRenewNotification;
  const content = new sendgrid.Content(
    'text/html', template({ subject, firstName, days_left_to_renew })
  );
  const mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function thirtyDayOldPatientNotification(firstName, email, officeName) {
  const templateString = fs.readFileSync('./views/notifications/thirty_day_old_patient_notification.ejs', 'utf-8');
  const template = ejs.compile(templateString);
  const from_email = `doNotReply@${officeName}.com`;
  const to_email = new sendgrid.Email(email);
  const subject = EMAIL_SUBJECTS.client.thirtyDayOldPatientNotification;
  const content = new sendgrid.Content(
    'text/html', template({ firstName, subject })
  );
  const mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function sendTermsAndConditionsUpdatedEmail(firstName, email) {
  const templateString = fs.readFileSync('./views/notifications/terms_and_conditions_update.ejs', 'utf-8');
  const template = ejs.compile(templateString);

  const to_email = new sendgrid.Email(email);
  const subject = EMAIL_SUBJECTS.terms_and_conditions_update;
  const content = new sendgrid.Content(
    'text/html', template({ subject, site, firstName })
  );
  const mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

// Send this email to dentist office if the patient set's preferred contact method as email or phone
export function sendNewPatientNotificationEmail(officeEmail, patient, signupDateTime) {
  const templateString = fs.readFileSync('./views/notifications/new_patient_notification.ejs', 'utf-8');
  const template = ejs.compile(templateString);

  const to_email = new sendgrid.Email(officeEmail);
  const subject = EMAIL_SUBJECTS.dentist.new_patient;
  const content = new sendgrid.Content(
    'text/html', template({ subject, patient, signupDateTime })
  );
  const mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

// Send this email to dentist office regardless of the patient's contact preference
export function sendNewPatientNotificationEmailDefault(officeEmail, patient, signupDateTime) {
  const templateString = fs.readFileSync('./views/notifications/new_patient_notification_default.ejs', 'utf-8');
  const template = ejs.compile(templateString);

  const to_email = new sendgrid.Email(officeEmail);
  const subject = EMAIL_SUBJECTS.dentist.new_member;
  const content = new sendgrid.Content(
    'text/html', template({ subject, patient, signupDateTime })
  );
  const mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export async function clientWelcomeEmail(res, user, usersSubscription, dentistPlans) {
  try {
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

    const templateString = fs.readFileSync('./views/auth/client/welcome.ejs', 'utf-8');
    const template = ejs.compile(templateString);

    const to_email = new sendgrid.Email(user.email);
    const subject = EMAIL_SUBJECTS.client.welcome;
    const content = new sendgrid.Content(
      'text/html', template({
        ...dentistContactInfo,

        site,
        subject,
        user,
        paymentDetails,
      })
    );
    const from_email = new sendgrid.Email(dentistContactInfo.officeEmail);
    const mail = new sendgrid.Mail(from_email, subject, to_email, content);
    sendMail(mail);
  } catch (e) {
    console.log(e, 'Error in clientWelcomeEmail');
  }
}

function constructDentistInfo(dentist) {
  const { dentistInfo } = dentist;

  const dentistContactInfo = {
    officeName: dentistInfo.officeName,
    officeEmail: dentistInfo.email,
    officePhone: dentistInfo.phone,
    officeAddress: dentistInfo.address,
    officeCity: dentistInfo.city,
    officeState: dentistInfo.state,
    officeZip: dentistInfo.zipCode,
  };

  for (const key in dentistContactInfo) {
    if (dentistContactInfo.hasOwnProperty(key)) {
      dentistContactInfo[key] = dentistContactInfo[key].replace(/  /g, '');
    }
  }

  return dentistContactInfo;

/*
  return `
    Dentist Name: ${dentist.firstName + dentist.lastName},
    Office Name: ${dentistInfo.officeName},
    Dentist Email: ${dentist.email},
    Dentist Office Email: ${dentistInfo.email},
    Office Address: ${dentistInfo.address || ''}, ${dentistInfo.city || ''}, ${dentistInfo.zipCode || ''}, ${dentistInfo.state || ''}\n
  `.replace(/  /g, '');
*/
}

function constructPaymentDetails(subs, plans) {
  const total = plans.reduce((acc, p) => {
    subs.forEach((s) => {
      if (s.membershipId === p.id) {
        acc += parseFloat(p.price);
      }
    });
    return acc;
  }, 0);

  return `
    Total Family Members Subscribed: ${subs.length},
    Subtotal: ${String(total)}.00 $
  `.replace(/  /g, '');
}
