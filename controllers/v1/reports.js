/* eslint max-len: 0 */
/* eslint-disable camelcase */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import Moment from 'moment';
import pdf from 'html-pdf';
import nunjucks from 'nunjucks';
import _ from 'lodash';

import {
  userRequired,
  dentistRequired,
  injectDentistOffice,
  adminRequired,
} from '../middlewares';

import db from '../../models';

import {
  BadRequestError,
  ForbiddenError
} from '../errors';

import {
  transformFieldsToFixed,
  recursiveCharges,
  recursiveInvoices,
} from '../../helpers/reports';

// ────────────────────────────────────────────────────────────────────────────────
// TEMPLATES

nunjucks.configure('../../views');

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

/**
 * Retrieves a list of URLs for the FE to link to for Report URLs
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getListOfReportURLs(req, res) {
  // 1. Reports start when dentistOffice was established
  const left = new Moment(req.locals.office.createdAt).set('date', '1');
  const dates = {};
  while (left.diff(Moment.now()) <= 0) {

    if (left.month() === Moment().month()) {
      if (left.year() === Moment().year()) {
        break;
      }
    }
    const month = Moment.months()[left.month()];
    const monthShort = Moment.monthsShort()[left.month()];
    const year = left.year();

    if (!dates[year]) {
      dates[year] = [];
    }
    dates[year].push({
      month,
      year,
      monthShort,
      url: `/reports/dentist/${req.locals.office.id}/general_report/${year}/${monthShort}`
    });
    left.add(1, 'month');
  }

  res.json({ data: dates });
}

function getMasterDates(req, res) {
  // we start calculating dates from Jan 1st 2017
  const initialDate = Moment('2017-01-01', 'YYYY-MM-DD');
  const dates = {};
  while (initialDate.diff(Moment.now()) <= 0) {

    if (initialDate.month() === Moment().month()) {
      if (initialDate.year() === Moment().year()) {
        break;
      }
    }
    const month = Moment.months()[initialDate.month()];
    const monthShort = Moment.monthsShort()[initialDate.month()];
    const year = initialDate.year();

    if (!dates[year]) {
      dates[year] = [];
    }
    dates[year].push({
      month,
      year,
      monthShort,
      url: `admin/master_report/${year}/${monthShort}`
    });

    initialDate.add('1', 'month');
  }
  return res.status(200).send({ data: dates });
}

/**
 * Retrieves a master report on all dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
async function getMasterReport(req, res) {
  try {
    // BEGIN Date Ops
    let targetMonth = Moment.monthsShort().indexOf(req.params.month);
    if (targetMonth === -1) {
      throw { errors: 'Invalid Month given' };
    }

    const fullMonthName = Moment.months()[targetMonth];
    targetMonth += 1;
    if (targetMonth < 10) {
      targetMonth = String(`0${targetMonth}`);
    }
    const targetYear = req.params.year;
    const targetDate = Moment.utc(`${targetYear}-${targetMonth}-01`, 'YYYY-MM-DD');
    const targetDateCopy = Moment(targetDate);
    const daysInTargetMonth = Moment(`${targetYear}-${targetMonth}`, 'YYYY-MM').daysInMonth();
    // END Date Ops

    let localDentistInfos = await db.DentistInfo.findAll({
      include: [{
        model: db.User,
        as: 'user'
      }]
    }).map(t => t.toJSON());

    // BEGIN Get all invoices recursively
    const chargesGte = targetDate.set('H', 0).set('m', 0).set('s', 0).unix();
    const chargesLte = targetDateCopy.set('date', daysInTargetMonth).set('H', 23).set('m', 59).set('s', 59)
      .unix();
    const allStripeCharges = await recursiveCharges([], null, { gte: chargesGte, lte: chargesLte });
    // END Get all invoices recursively

    const payments = allStripeCharges
      .filter(charge => charge.status === 'succeeded')
      .map((charge) => {
        const { amount_refunded } = charge;
        if (amount_refunded) {
          const amount = charge.amount - amount_refunded;
          return {
            ...charge,
            amount
          };
        }
        return { ...charge };
      });

    const localSubscriptions = await db.Subscription.findAll({
      attributes: ['dentistId', 'paymentProfileId']
    })
      .map(s => s.toJSON());

    const localPaymentProfiles = await db.PaymentProfile.findAll()
      .map(p => p.toJSON());
    const uniqLocalSubscriptions = _.uniqBy(localSubscriptions, 'paymentProfileId');

    const dentistStripeCustomerIdMapping = uniqLocalSubscriptions
      .reduce((acc, sub) => {
        const { dentistId, paymentProfileId } = sub;
        if (!paymentProfileId || !dentistId) {
          return acc;
        }
        const { stripeCustomerId } = localPaymentProfiles.find(profile => Number(profile.id) === Number(paymentProfileId));
        if (acc[dentistId]) {
          acc[dentistId].push(stripeCustomerId);
        } else {
          acc[dentistId] = [stripeCustomerId];
        }
        return acc;
      }, {});

    const datePeriod = `${fullMonthName} ${targetYear}`;

    localDentistInfos = localDentistInfos.map((dentistInfo) => {
      // Only construct the payments related to this dentist
      let filteredPayments = [];
      if (dentistStripeCustomerIdMapping[dentistInfo.userId]) {
        filteredPayments = payments.filter((payment) => {
          const isMyPatient = dentistStripeCustomerIdMapping[dentistInfo.userId]
            .includes(payment.customer);
          if (isMyPatient) {
            return true;
          }
          return false;
        });
      }
      const gross = filteredPayments.reduce((acc, p) => acc + p.amount, 0) / 100;
      const managementFee = gross * (11 / 100);
      const net = gross - managementFee;
      return {
        ...dentistInfo,
        gross: gross.toFixed(2),
        managementFee: managementFee.toFixed(2),
        net: net.toFixed(2)
      };
    });

    const totals = localDentistInfos
      .reduce((acc, dentist) => {
        const { gross, managementFee, net } = acc;
        const { gross: dentistGross, managementFee: dentistManagementFee, net: dentistNet } = dentist;
        return {
          gross: gross + Number(dentistGross),
          managementFee: managementFee + Number(dentistManagementFee),
          net: net + Number(dentistNet)
        };
      }, { gross: 0, managementFee: 0, net: 0 });

    // Fetch the master template file
    const masterTemplate = fs.readFileSync(
      path.resolve(`${__dirname}/../../views/reports/master-report.1.html`),
      'utf8'
    );

    // Compose the master report
    const report = nunjucks.renderString(masterTemplate, {
      datePeriod,
      records: localDentistInfos,
      totals,
    });

    // Send PDF file
    pdf.create(report, { format: 'Letter' }).toBuffer((err, resp) => {
      if (err) { res.json(new BadRequestError(err)); }
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.write(resp);
      res.end();
    });
  } catch (e) {
    console.log('Error in getMasterReports');
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
/**
 * Retrieves a PDF report for general membership/costs
 * information about the members of a dentist office
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
async function getGeneralReport(req, res) {
  try {
    const { dentistId } = req.params;
    const dentist = await db.User.findOne({ where: { id: dentistId } });
    const dentistInfo = await db.DentistInfo.findOne({ where: { userId: dentistId } });
    const { name: dentistSpecialityName } = await db.DentistSpecialty.findOne({ where: { id: dentist.dentistSpecialtyId } });

    // BEGIN Date Ops
    let targetMonth = Moment.monthsShort().indexOf(req.params.month);
    if (targetMonth === -1) {
      throw { errors: 'Invalid Month given' };
    }
    const fullMonthName = Moment.months()[targetMonth];
    targetMonth += 1;
    if (targetMonth < 10) {
      targetMonth = String(`0${targetMonth}`);
    }
    const targetYear = req.params.year;
    const targetDate = Moment.utc(`${targetYear}-${targetMonth}-01`, 'YYYY-MM-DD');
    const targetDateCopy = Moment(targetDate, 'YYYY-MM-DD');
    const daysInTargetMonth = Moment(`${targetYear}-${targetMonth}`, 'YYYY-MM').daysInMonth();
    // END Date Ops

    const date = `${fullMonthName} ${targetYear}`;
    const dentistSubscriptions = await db.Subscription.findAll({
      where: {
        dentistId
      }
    });

    const filteredPaymentProfileIds = dentistSubscriptions
      .reduce((acc, s) => {
        if (!acc.includes(s.paymentProfileId)) {
          acc.push(s.paymentProfileId);
        }
        return acc;
      }, []);
    const paymentProfileRecords = await db.PaymentProfile.findAll({
      where: {
        id: filteredPaymentProfileIds
      }
    });

    const stripeCustomerIds = paymentProfileRecords
      .map(profile => profile.stripeCustomerId);

    console.info(stripeCustomerIds);

    // BEGIN Get all charges recursively
    const chargesGte = targetDate.set('H', 0).set('m', 0).set('s', 0).unix();
    const chargesLte = targetDateCopy
      .set('date', daysInTargetMonth).set('H', 23).set('m', 59).set('s', 59)
      .unix();

    const allStripeCharges = await recursiveCharges([], null, { gte: chargesGte, lte: chargesLte });
    // END Get all charges recursively

    const myPatientsStripeCharges = allStripeCharges
      .filter(charge => stripeCustomerIds.includes(charge.customer) && charge.status === 'succeeded');

    // BEGIN get payments
    const payments = myPatientsStripeCharges
      .filter((charge) => {
        if (charge.description) {
          return !charge.description.toLowerCase().includes('penalty');
        }
        return true;
      })
      .map((charge) => {
        const { amount_refunded } = charge;
        if (amount_refunded) {
          const amount = charge.amount - amount_refunded;
          return {
            ...charge,
            amount
          };
        }
        return { ...charge };
      });

    // END get payments
    // BEGIN get refunds
    const refundsRecords = myPatientsStripeCharges
      .filter(charge => charge.amount_refunded);
    const refunds = refundsRecords
      .reduce((acc, { amount_refunded }) => acc + (amount_refunded / 100), 0)
      .toFixed(2);
    // END get refunds
    // BEGIN get penalties
    const penaltiesRecords = myPatientsStripeCharges
      .filter(charge => charge.description)
      .filter(charge => charge.description.toLowerCase().includes('penalty'));
    // END get penalties
    const grossRevenue = payments
      .reduce((acc, { amount }) => acc + (amount / 100), 0);
    const managementFee = (grossRevenue * (11 / 100)).toFixed(2);
    const netPayment = (grossRevenue - managementFee - Number(refunds)).toFixed(2);

    const parentMemberRecords = [];

    for (const profile of paymentProfileRecords) {
      const { stripeCustomerId } = profile;
      const parentLocal = {};
      const parent = await db.User.findOne({ where: { id: profile.primaryAccountHolder } });
      parentLocal.parentId = parent.id;
      parentLocal.firstName = parent.firstName;
      parentLocal.lastName = parent.lastName;
      parentLocal.maturity = 'Adult';
      parentLocal.origin = parent.origin;

      parentLocal.fee = payments
        .filter(payment => payment.customer === stripeCustomerId)
        .reduce((acc, payment) => acc + (payment.amount / 100), 0)
        .toFixed(2);

      parentLocal.penalties = penaltiesRecords
        .filter(penaltyRecord => penaltyRecord.customer === stripeCustomerId)
        .reduce((acc, penalty) => acc + (penalty.amount / 100), 0)
        .toFixed(2);

      parentLocal.refunds = refundsRecords
        .filter(refundsRecord => refundsRecord.customer === stripeCustomerId)
        .reduce((acc, refund) => acc + (refund.amount_refunded / 100), 0)
        .toFixed(2);

      const localTotal = Number(parentLocal.fee) + Number(parentLocal.penalties);
      const localManagementFees = localTotal * (11 / 100);
      parentLocal.net = localTotal - localManagementFees - Number(parentLocal.refunds);
      parentLocal.net = parentLocal.net.toFixed(2);

      parentLocal.family = [];

      parentLocal.membershipFeeTotal = parentLocal.fee;
      parentLocal.penaltiesTotal = parentLocal.penalties;
      parentLocal.refundsTotal = parentLocal.refunds;
      parentLocal.netTotal = parentLocal.net;
      parentMemberRecords.push(parentLocal);
    }

    const totalMembers = parentMemberRecords.length;
    const totalExternal = parentMemberRecords
      .filter(r => r.origin === 'external').length;
    const totalInternal = parentMemberRecords
      .filter(r => r.origin === 'internal').length;
    const totalNewMembers = totalMembers;
    const totalNewExternal = totalExternal;
    const totalNewInternal = totalInternal;

    const reportData = {
      title: `${dentistInfo.officeName} -- General Report`,
      dentistSpecialityName,
      date,
      totalMembers,
      parentMemberRecords,
      totalNewMembers,
      totalExternal,
      totalNewExternal,
      totalInternal,
      totalNewInternal,
      grossRevenue: grossRevenue.toFixed(2),
      refunds,
      managementFee,
      netPayment,
    };

    const generalTemplate = fs.readFileSync(
      path.resolve(`${__dirname}/../../views/reports/general-report.1.html`),
      'utf8'
    );
    const report = nunjucks.renderString(generalTemplate, reportData);
    const downloadFilename = `${reportData.title.split(' ').join('-')}_${report.date}.pdf`;

    pdf.create(report, { format: 'Letter' }).toBuffer((err, resp) => {
      if (err) { res.json(new BadRequestError(err)); }
      res.setHeader('Content-disposition', `attachment; filename=${downloadFilename}`);
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.write(resp);
      res.end();
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ message: 'Internal Server Error' });
  }
}

const router = new Router({ mergeParams: true });

router.route('/master_dates')
  .get(
    userRequired,
    adminRequired,
    getMasterDates
  );

router.route('/dentist/dates/:officeId/list')
  .get(
    userRequired,
    dentistRequired,
    injectDentistOffice('officeId', 'office'),
    getListOfReportURLs);

router.route('/admin/master_report/:year/:month')
  .get(
    userRequired,
    adminRequired,
    getMasterReport
  );

router.route('/dentist/:dentistId/general_report/:year/:month')
  .get(
    userRequired,
    dentistRequired,
    getGeneralReport
  );

export default router;
