const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);

var sendgrid = require('sendgrid').mail;
var ejs = require('ejs');
var fs = require('fs')

import {
  EMAIL_SUBJECTS,
} from '../config/constants';
import db from '../models';

const site = process.env.SITE;
const dentalhq_from_email = new sendgrid.Email("donotreply@dentalhq.com");

function sendMail(mail) {
  let request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON(),
  });

  sg.API(request, function (error, response) {
    if (error) {
      console.log(error.response.body);
    }
    else {
      console.log(response.statusCode);
    }
  });
}

export function membershipPriceChangeNotificationAdvance(user, plan_name, price, officeName, officeInfo) {
  var templateString = fs.readFileSync('./views/notifications/membership_price_update_advance.ejs', 'utf-8');

  var template = ejs.compile(templateString);
  var priceS = price.toString();
  const from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.membershipPriceUpdate;
  let content = new sendgrid.Content(
    'text/html', template({ user, plan_name, price: priceS, subject, officeName, dentistInfo: officeInfo })
  );
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function membershipPriceChangeNotification(user, plan_name, price) {
  var templateString = fs.readFileSync('./views/notifications/membership_price_update.ejs', 'utf-8');

  var priceS = price.toString();
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.membershipPriceUpdate;
  let content = new sendgrid.Content(
    'text/html', template({ user, plan_name, price: priceS, subject })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function subscriptionChargeFailedNotification(user, attempt_count) {
  var templateString = fs.readFileSync('./views/notifications/subscription_charge_failed.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.subscriptionChargeFailed;
  let days_late;
  attempt_count = parseInt(attempt_count);
  if (attempt_count == 1) {
    days_late = 1;
  } else if (attempt_count == 2) {
    days_late = 7;
  } else if (attempt_count == 3) {
    days_late = 14;
  } else {
    days_late = 21;
  }
  let content = new sendgrid.Content(
    'text/html', template({ user, days_late, subject })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function subscriptionCancellationNotification(user, officeName) {
  var templateString = fs.readFileSync('./views/notifications/subscription_cancellation.ejs', 'utf-8');
  var template = ejs.compile(templateString);
  const from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.subscriptionCancellation;
  let content = new sendgrid.Content(
    'text/html', template({ user, subject })
  );
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function annualPlanRenewAdvanceNotificationEmail(firstName, email, days_left_to_renew) {
  var templateString = fs.readFileSync('./views/notifications/annual_plan_renew_advance_notification.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(email);
  let subject = EMAIL_SUBJECTS.client.annualPlanRenewNotification;
  let content = new sendgrid.Content(
    'text/html', template({ subject, firstName, days_left_to_renew })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function thirtyDayOldPatientNotification(firstName, email) {
  var templateString = fs.readFileSync('./views/notifications/thirty_day_old_patient_notification.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(email);
  let subject = EMAIL_SUBJECTS.client.thirtyDayOldPatientNotification;
  let content = new sendgrid.Content(
    'text/html', template({ firstName, subject })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

export function sendTermsAndConditionsUpdatedEmail(firstName, email) {
  var templateString = fs.readFileSync('./views/notifications/terms_and_conditions_update.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(email);
  let subject = EMAIL_SUBJECTS.terms_and_conditions_update;
  let content = new sendgrid.Content(
    'text/html', template({ subject, site, firstName })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

// Send this email to dentist office if the patient set's preferred contact method as email or phone
export function sendNewPatientNotificationEmail(officeEmail, patient, signupDateTime) {
  var templateString = fs.readFileSync('./views/notifications/new_patient_notification.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(officeEmail);
  let subject = EMAIL_SUBJECTS.dentist.new_patient;
  let content = new sendgrid.Content(
    'text/html', template({ subject, patient, signupDateTime })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
  sendMail(mail);
}

// Send this email to dentist office regardless of the patient's contact preference
export function sendNewPatientNotificationEmailDefault(officeEmail, patient, signupDateTime) {
  var templateString = fs.readFileSync('./views/notifications/new_patient_notification_default.ejs', 'utf-8');
  var template = ejs.compile(templateString);

  let to_email = new sendgrid.Email(officeEmail);
  let subject = EMAIL_SUBJECTS.dentist.new_member;
  let content = new sendgrid.Content(
    'text/html', template({ subject, patient, signupDateTime })
  );
  let mail = new sendgrid.Mail(dentalhq_from_email, subject, to_email, content);
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

    var templateString = fs.readFileSync('./views/auth/client/welcome.ejs', 'utf-8');
    var template = ejs.compile(templateString);

    let to_email = new sendgrid.Email(user.email);
    let subject = EMAIL_SUBJECTS.client.welcome;
    let content = new sendgrid.Content(
      'text/html', template({
        ...dentistContactInfo,

        site,
        subject,
        user,
        paymentDetails,
      })
    );
    const from_email = new sendgrid.Email(dentistContactInfo.officeEmail);
    let mail = new sendgrid.Mail(from_email, subject, to_email, content);
    sendMail(mail);
  } catch (e) {
    console.log(e, 'Error in clientWelcomeEmail');
  }
}

function constructDentistInfo(dentist) {
  const { dentistInfo } = dentist;

  let dentistContactInfo = {
    dentistName: dentist.firstName + ' ' + dentist.lastName,
    dentistEmail: dentist.email,
    officeName: dentistInfo.officeName,
    officeEmail: dentistInfo.email,
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
    subs.forEach(s => {
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
