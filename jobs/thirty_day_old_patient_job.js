/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import moment from 'moment';
import db from '../models';
import { thirtyDayOldPatientNotification } from '../controllers/sendgrid_mailer';

export default async function thirtyDayOldPatientJob() {
  try {
    const oneMonthBeforeToday = moment().subtract(1, 'month');
    const oneMonthBeforeTodayCopy = moment(oneMonthBeforeToday);
    const thirtyDayOldPatients = await db.User.findAll({
      where: {
        createdAt: {
          $between: [
            oneMonthBeforeToday.set('H', 0).set('m', 0).set('s', 0).format('YYYY-MM-DD HH:mm:ss'),
            oneMonthBeforeTodayCopy.set('H', 23).set('m', 59).set('s', 59).format('YYYY-MM-DD HH:mm:ss'),
          ]
        },
        type: 'client',
        hash: {
          $ne: null
        }
      },
      attributes: ['firstName', 'email', 'id'],
    });

    for (const patient of thirtyDayOldPatients) {
      const subscription = await db.Subscription.findOne({
        where: {
          clientId: patient.id
        },
        attributes: ['dentistId']
      });
      const dentistInfo = await db.DentistInfo.findOne({
        where: {
          userId: subscription.dentistId
        },
        attributes: ['officeName']
      });
      const { officeName } = dentistInfo;
      const { firstName, email } = patient;
      thirtyDayOldPatientNotification(firstName, email, officeName.replace(/ /g, ''));
    }
  } catch (e) {
    throw e;
  }
}
