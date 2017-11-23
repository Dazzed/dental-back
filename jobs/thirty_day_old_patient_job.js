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
      attributes: ['firstName', 'email'],
    });
    thirtyDayOldPatients.forEach((patient) => {
      thirtyDayOldPatientNotification(patient.firstName, patient.email);
    });
  } catch (e) {
    throw e;
  }
}
