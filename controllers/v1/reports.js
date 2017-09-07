/* eslint max-len: 0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import Moment from 'moment';
import pdf from 'html-pdf';
import nunjucks from 'nunjucks';

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
    const targetDate = Moment(`${targetYear}-${targetMonth}-01`, 'YYYY-MM-DD');
    const targetDateCopy = Moment(targetDate);
    const daysInTargetMonth = Moment(`${targetYear}-${targetMonth}`,'YYYY-MM').daysInMonth();

    let dentists = await db.DentistInfo.findAll({
      include:[{
        model: db.User,
        as: 'user'
      }]
    }).map(t => t.toJSON());
    
    const payments = await db.Payment.findAll({
      where: {
        createdAt: {
          $between: [targetDate.format('YYYY-MM-DD'), targetDateCopy.set('date', daysInTargetMonth).format('YYYY-MM-DD')]
        }
      }
    }).map(t => t.toJSON());

    const datePeriod = `${fullMonthName} ${targetYear}`;

    dentists = dentists.map(dentist => {
      const filteredPayments = payments.filter(payment => payment.dentistId === dentist.id);
      const gross = filteredPayments.reduce((acc, p) => acc += p.amount, 0);
      const managementFee = gross * (11 / 100);
      const net = gross - managementFee;
      return {
        ...dentist,
        gross: Math.round(gross / 100, 2),
        managementFee: Math.round(managementFee / 100, 2),
        net: Math.round(net / 100, 2)
      };
    });

    const totals = dentists.reduce((acc, dentist) => {
      const { gross, managementFee, net } = acc;
      const { gross: dentistGross, managementFee: dentistManagementFee, net: dentistNet } = dentist;
      return {
        gross: gross + dentistGross,
        managementFee: managementFee + dentistManagementFee,
        net: net + dentistNet
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
      records: dentists,
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
    console.log('Error in getMasterReportCleaned');
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
async function getGeneralReport(req,res) {
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
    const targetDate = Moment(`${targetYear}-${targetMonth}-01`, 'YYYY-MM-DD');
    const targetDateCopy = Moment(targetDate);
    const daysInTargetMonth = Moment(`${targetYear}-${targetMonth}`,'YYYY-MM').daysInMonth();
    // END Date Ops

    const date = `${fullMonthName} ${targetYear}`;
    const dentistSubscriptions = await db.Subscription.findAll({
      where: {
        dentistId,
        createdAt: {
          $between: [targetDate.format('YYYY-MM-DD'), targetDateCopy.set('date', daysInTargetMonth).format('YYYY-MM-DD')]
        }
      }
    });

    const totalMembers = dentistSubscriptions.length;
    const totalExternal = 0;
    const totalInternal = totalMembers;
    const totalNewMembers = totalMembers;
    const totalNewExternal = 0;
    const totalNewInternal = totalMembers;

    const payments = await db.Payment.findAll({ 
      where: {
        dentistId,
        createdAt: {
          $between: [targetDate.format('YYYY-MM-DD'), targetDateCopy.set('date', daysInTargetMonth).format('YYYY-MM-DD')]
        }
      }
    });
    const grossRevenue = payments.reduce((acc,p) => acc += Math.round(p.amount / 100, 2), 0);

    const refundsRecords = await db.Refund.findAll({
      where: {
        dentistId,
        createdAt: {
          $between: [targetDate.format('YYYY-MM-DD'), targetDateCopy.set('date', daysInTargetMonth).format('YYYY-MM-DD')]
        }
      }
    });
    const refunds = refundsRecords.reduce((acc,p) => acc += Math.round(p.amount / 100, 2), 0);

    const penaltiesRecords = await db.Penality.findAll({
      where: {
        dentistId,
        createdAt: {
          $between: [targetDate.format('YYYY-MM-DD'), targetDateCopy.set('date', daysInTargetMonth).format('YYYY-MM-DD')]
        }
      }
    });
    const penalties = penaltiesRecords.reduce((acc,p) => acc += Math.round(p.amount / 100, 2), 0);
    
    const managementFee = Math.round(grossRevenue * (11 / 100), 2);
    const netPayment = grossRevenue - managementFee;

    const filteredPaymentProfileIds = dentistSubscriptions
      .reduce((acc, s) => {
        if (!acc.includes(s.paymentProfileId)) {
          acc.push(s.paymentProfileId);
        }
        return acc;
      }, []);
    const paymentProfileRecords = await db.PaymentProfile.findAll({ where: {
      id: filteredPaymentProfileIds
    } });

    const parentMemberRecords = [];

    for (let profile of paymentProfileRecords) {
      let parentLocal = {};
      let parent = await db.User.findOne({ where: { id: profile.primaryAccountHolder } });
      parentLocal.parentId = parent.id;
      let childMembers = await db.User.findAll({ where: { addedBy: parent.id } });
      parentLocal.firstName = parent.firstName;
      parentLocal.lastName = parent.lastName;
      parentLocal.maturity = 'Adult';
      const parentFee = payments.find(p => p.clientId == parent.id);
      parentLocal.fee = parentFee ? Math.round(parentFee.amount / 100, 2) : 0;
      
      parentLocal.penalties = penaltiesRecords.filter(p => p.clientId == parent.id)
        .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
      parentLocal.refunds = refundsRecords.filter(p => p.clientId == parent.id)
        .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
      parentLocal.net = Math.round(parentLocal.fee - parentLocal.fee * (11/100), 2);

      parentLocal.family = [];
      childMembers.forEach(child => {
        const childLocal = {};
        childLocal.firstName = child.firstName;
        childLocal.lastName = child.lastName;
        childLocal.maturity = Moment('YYYY-MM-DD').subtract(Moment(child.birthDate, 'YYYY-MM-DD'), 'years') >= 18 ? 'Adult' : 'Child';
        const childLocalFee = payments.find(p => p.clientId == child.id);
        childLocal.fee = childLocalFee ? Math.round(childLocalFee.amount / 100, 2) : 0;
        childLocal.penalties = penaltiesRecords.filter(p => p.clientId == child.id)
          .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
        childLocal.refunds = refundsRecords.filter(p => p.clientId == child.id)
          .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
        childLocal.net = Math.round(childLocal.fee - (childLocal.fee * (11 / 100)), 2);
        parentLocal.family.push(childLocal);
      });
      parentLocal.membershipFeeTotal = payments
        .filter(p => p.clientId == parent.id || childMembers.map(c => c.id).includes(p.clientId))
        .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
      parentLocal.penaltiesTotal = penaltiesRecords
        .filter(p => p.clientId == parent.id || childMembers.map(c => c.id).includes(p.clientId))
        .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
      parentLocal.refundsTotal = refundsRecords
        .filter(p => p.clientId == parent.id || childMembers.map(c => c.id).includes(p.clientId))
        .reduce((acc, p) => acc += Math.round(p.amount / 100, 2) ,0);
      parentLocal.netTotal = Math.round(parentLocal.membershipFeeTotal - (parentLocal.membershipFeeTotal * (11 / 100)), 2);
      parentMemberRecords.push(parentLocal);
    }

    const reportData = {
      title: `${dentistInfo.officeName} -- General Report`,
      dentistSpecialityName,
      date,
      totalMembers: parentMemberRecords.length,
      parentMemberRecords,
      totalNewMembers,
      totalExternal,
      totalNewExternal,
      totalInternal,
      totalNewInternal,
      grossRevenue,
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
    return res.status(500).send({ errors: "Internal Server error" });
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
