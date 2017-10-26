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

    const elevenMonthsAfterToday = moment().add(11, 'months');
    const thirtyDaysLeftSubscriptions = await db.Subscription.findAll({
      where: {
        membershipId: {
          $in: annualMembershipIds
        },
        stripeSubscriptionIdUpdatedAt: {
          $lt: elevenMonthsAfterToday.subtract(1, 'day').format('YYYY-MM-DD'),
          $gt: elevenMonthsAfterToday.add(1, 'day').format('YYYY-MM-DD')
        },
        status: 'active'
      },
      attributes: ['paymentProfileId']
    }).map(s => s.paymentProfileId);

    const elevenMonthsForteenDaysAfterToday = moment().add(11, 'months').add(14, 'days');
    const fourteenDaysLeftSubscriptions = await db.Subscription.findAll({
      where: {
        membershipId: {
          $in: annualMembershipIds
        },
        stripeSubscriptionIdUpdatedAt: {
          $lt: elevenMonthsForteenDaysAfterToday.subtract(1, 'day').format('YYYY-MM-DD'),
          $gt: elevenMonthsForteenDaysAfterToday.add(1, 'day').format('YYYY-MM-DD')
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
