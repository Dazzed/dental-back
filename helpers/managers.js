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
  users.forEach(user => {
    sendTermsAndConditionsUpdatedEmail(user.firstName, user.email);
  });
}

export {
  termsAndConditionsUpdateNotification
};
