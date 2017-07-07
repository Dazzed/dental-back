import db from '../models';
import {
  membershipPriceChangeNotification,
  membershipPriceChangeNotificationAdvance
} from '../controllers/sendgrid_mailer';

export function notifyMembershipPriceUpdate(clientId,plan_name, new_price) {
  let planName = plan_name;
  let newPrice = new_price;
  db.User.findOne({
    where:{
      id: clientId
    }
  }).then(user => {
    membershipPriceChangeNotification(user, planName, newPrice);
  });
}

export function notifyMembershipPriceUpdateAdvance(clientId,plan_name, new_price) {
  let planName = plan_name;
  let newPrice = new_price;
  db.User.findOne({
    where:{
      id: clientId
    }
  }).then(user => {
    membershipPriceChangeNotificationAdvance(user, planName, newPrice);
  });
}