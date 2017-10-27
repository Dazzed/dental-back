import moment from 'moment';

import db from '../models';
import { annualPlanRenewAdvanceNotificationEmail } from '../controllers/sendgrid_mailer';

export default async function annualPlanRenewAdvanceNotification() {
  try {
    // Get all annual membership plans
    const annualMembershipIds = await db.Membership.findAll({
      where: {
        type: 'year'
      },
      attributes: ['id']
    }).map(m => m.id);

    const elevenMonthsBeforeToday = moment().subtract(11, 'months');
    const elevenMonthsBeforeTodayCopy = moment(elevenMonthsBeforeToday);
    const thirtyDaysLeftSubscriptions = await db.Subscription.findAll({
      where: {
        membershipId: {
          $in: annualMembershipIds
        },
        stripeSubscriptionIdUpdatedAt: {
          $between: [
            elevenMonthsBeforeToday.set('H', 0).set('m', 0).set('s', 0).format('YYYY-MM-DD HH:mm:ss'),
            elevenMonthsBeforeTodayCopy.set('H', 0).set('m', 0).set('s', 0).format('YYYY-MM-DD HH:mm:ss')
          ]
        },
        status: 'active'
      },
      attributes: ['paymentProfileId']
    }).map(s => s.paymentProfileId);

    const elevenMonthsForteenDaysBeforeToday = moment().subtract(11, 'months').subtract(14, 'days');
    const elevenMonthsForteenDaysBeforeTodayCopy = moment(elevenMonthsForteenDaysBeforeToday);
    const fourteenDaysLeftSubscriptions = await db.Subscription.findAll({
      where: {
        membershipId: {
          $in: annualMembershipIds
        },
        stripeSubscriptionIdUpdatedAt: {
          $gt: elevenMonthsForteenDaysBeforeToday.set('H', 0).set('m', 0).set('s', 0).format('YYYY-MM-DD HH:mm:ss'),
          $lt: elevenMonthsForteenDaysBeforeTodayCopy.set('H', 0).set('m', 0).set('s', 0).format('YYYY-MM-DD HH:mm:ss')
        },
        status: 'active'
      },
      attributes: ['paymentProfileId']
    }).map(s => s.paymentProfileId);

    if (thirtyDaysLeftSubscriptions.length) {
      const thirtyDayLeftUserIds = Array.from(new Set(
        thirtyDaysLeftSubscriptions.map(s => s.paymentProfileId)
      ));
      const thirtyDayLeftUsers = await db.User.findAll({
        where: {
          id: {
            $in: thirtyDayLeftUserIds
          },
          attributes: ['firstName', 'email']
        }
      });
      thirtyDayLeftUsers.forEach((u) => {
        annualPlanRenewAdvanceNotificationEmail(
          u.firstName, u.email, '30'
        );
      });
    }

    if (fourteenDaysLeftSubscriptions.length) {
      const fourteenDaysLeftUserIds = Array.from(new Set(
        fourteenDaysLeftSubscriptions.map(s => s.paymentProfileId)
      ));
      const fourteenDaysLeftUsers = await db.User.findAll({
        where: {
          id: {
            $in: fourteenDaysLeftUserIds
          },
          attributes: ['firstName', 'email']
        }
      });
      fourteenDaysLeftUsers.forEach((u) => {
        annualPlanRenewAdvanceNotificationEmail(
          u.firstName, u.email, '14'
        );
      });
    }
  } catch (e) {
    throw e;
  }
}
