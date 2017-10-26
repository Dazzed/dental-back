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
            oneMonthBeforeToday.subtract(1, 'day').format('YYYY-MM-DD'),
            oneMonthBeforeTodayCopy.add(1, 'day').format('YYYY-MM-DD')
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
