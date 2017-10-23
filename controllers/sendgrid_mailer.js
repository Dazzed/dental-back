const sg = require('sendgrid')(process.env.SENDGRID_API_KEY);

var sendgrid = require('sendgrid').mail;
var ejs = require('ejs');
var fs = require('fs')

import {
  EMAIL_SUBJECTS,
} from '../config/constants';

let from_email = new sendgrid.Email("donotreply@dentalhq.com");

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
  from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
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
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
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
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}

export function subscriptionCancellationNotification(user, officeName) {
  var templateString = fs.readFileSync('./views/notifications/subscription_cancellation.ejs', 'utf-8');
  var template = ejs.compile(templateString);
  from_email = new sendgrid.Email(`donotreply@${officeName}.com`);
  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.subscriptionCancellation;
  let content = new sendgrid.Content(
    'text/html', template({ user, subject })
  );
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}