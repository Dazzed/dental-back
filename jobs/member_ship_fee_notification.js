import db from '../models';
import {membershipPriceChangeNotification} from '../controllers/sendgrid_mailer';

export default function notifyMembershipPriceUpdate(clientId,plan_name, new_price) {
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