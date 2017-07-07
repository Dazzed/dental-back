var sendgrid = require('sendgrid').mail;
var ejs = require('ejs');
var fs = require('fs')

import {
  EMAIL_SUBJECTS,
} from '../config/constants';

var from_email = new sendgrid.Email("donotreply@dental-marketplace.com");

function sendMail(mail) {
  let sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
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

export function membershipPriceChangeNotificationAdvance(user, plan_name, price) {
  var templateString = fs.readFileSync('./views/notifications/membership_price_update_advance.ejs', 'utf-8');

  var template = ejs.compile(templateString);
  var priceS = price.toString();
  let to_email = new sendgrid.Email(user.email);
  let subject = EMAIL_SUBJECTS.client.membershipPriceUpdate;
  let content = new sendgrid.Content(
    'text/html', template({ user, plan_name, priceS })
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
    'text/html', template({ user, plan_name, priceS })
  );
  let mail = new sendgrid.Mail(from_email, subject, to_email, content);
  sendMail(mail);
}
