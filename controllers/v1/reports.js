/* eslint max-len: 0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import Moment from 'moment';
import pdf from 'html-pdf';
import nunjucks from 'nunjucks';
import moment from 'moment';

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
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getListOfReportURLs(req, res) {
  // 1. Reports start when dentistOffice was established
  const left = moment(req.dentist.dentistInfo.createdAt);
  const timeBlocks = [];

  while (left.diff(moment.now()) <= 0) {
    const month = moment.months()[left.month()];
    const monthShort = moment.monthsShort()[left.month()];
    const year = left.year();

    timeBlocks.push({
      month,
      year,
      url: `/reports/dentist/${req.dentist.id}/${year}/${monthShort}/general`
    });

    left.add(1, 'month');
  }

  res.json({ data: timeBlocks });
}

/**
 * Retrieves a PDF report for general membership/costs
 * information about the members of a dentist office
 *
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getGeneralReport(req, res) {
  const reportEndDate = new Moment();
  reportEndDate.year(req.params.year).month(req.params.month).date(1).subtract(1, 'day');

  db.DentistInfo.find({
    where: { id: req.params.officeId },
    include: [
      { model: db.User, as: 'user' },
      { model: db.Membership, as: 'childMembership' },
      { model: db.Membership, as: 'membership' }
    ]
  }).then(office => {
    if (!office) {
      res.json(new ForbiddenError('Requested Dentist Office does not access or user does not have appropriate access'));
    }

    // Validate the current user has the proper authorization to see this report
    if (req.user.id === office.user.id) {
      db.Subscription.findAll({
        where: { dentistId: office.user.id },
        include: [{
          model: db.User,
          as: 'client',
        }, {
          model: db.Membership,
          as: 'membership',
        }],
      }).then(members => {
        // Prepare the members model
        members = members.map(m => {
          m = m.toJSON();
          // Determine if they are new to the dentist's office
          m.isNew = (new Moment(m.startAt).isAfter(reportEndDate));
          // Determine if the member should be treated as a child or adult
          m.isAdult = (office.acceptsChildren && (m.client.familyRelationship === 'daughter' || m.client.familyRelationship === 'son'));
          return m;
        });

        const totalNewMembers = members.reduce((sum, m) => (m.isNew ? sum++ : sum), 0);
        const totalExternal = members.filter(m => m.client.origin === 'external').length;
        const totalNewExternal = members.filter(m => m.isNew && m.client.origin === 'external').length;
        const totalInternal = members.filter(m => m.client.origin === 'internal').length;
        const totalNewInternal = members.filter(m => m.isNew && m.client.origin === 'internal').length;

        const memberRecords = [];

        // Calculate gross revenue and prepare member records
        const grossRevenue = members.reduce((sum, m) => {
          const row = {
            member: m,
            maturity: 'Adult',
            fee: 0,
            penalties: 0,
            refunds: 0,
            net: 0,
          };

          if (office.acceptsChildren && m.membership.childYearlyFeeActivated) {
            // Child pricing
            row.fee = parseInt(office.childMembership.monthly, 10);
            row.maturity = 'Child';
          } else {
            // Adult pricing
            row.fee = parseInt(office.membership.monthly, 10);
            row.maturity = 'Adult';
          }

          row.net = ((row.fee + row.penalties) - row.refunds) * 0.11;
          memberRecords.push(row);
          return (sum + row.fee);
        }, 0);

        // Nest records by family owners
        const parentMemberRecords = memberRecords.reduce((recs, m) => {
          if (isNaN(parseInt(m.member.client.addedBy, 10))) {
            m.family = [];
            recs[m.member.client.id] = m;
          }
          return recs;
        }, {});

        // Nest child records of family owners
        memberRecords.filter(m => !isNaN(parseInt(m.member.client.addedBy, 10))).forEach(m => {
          const parent = parentMemberRecords[m.member.client.addedBy];
          if (parent !== undefined) {
            parentMemberRecords[m.member.client.addedBy].family.push(m);
          }
        });

        // Calculate family totals
        Object.keys(parentMemberRecords).forEach(prId => {
          const temp = {
            membershipFeeTotal: 0,
            penaltiesTotal: 0,
            refundsTotal: 0,
            netTotal: 0,
          };

          temp.membershipFeeTotal += parentMemberRecords[prId].fee;
          temp.penaltiesTotal += parentMemberRecords[prId].penalties;
          temp.refundsTotal += parentMemberRecords[prId].refunds;
          temp.netTotal += parentMemberRecords[prId].net;

          // Loop through family as well
          parentMemberRecords[prId].family.forEach(m => {
            temp.membershipFeeTotal += m.fee;
            temp.penaltiesTotal += m.penalties;
            temp.refundsTotal += m.refunds;
            temp.netTotal += m.net;
          });

          parentMemberRecords[prId] = Object.assign({}, parentMemberRecords[prId], temp);
        });

        // TODO: calculate refunds
        const refunds = 0;
        const managementFee = ((grossRevenue + refunds) * 0.11);
        const netPayment = (grossRevenue - managementFee);

        const generalTemplate = fs.readFileSync(
          path.resolve(`${__dirname}/../../views/reports/general-report.html`),
          'utf8'
        );

        // TODO: MISSING VALUES

        /**
         * Total Gross Revenue
         * Membership Fee per User
         * Penalties per User - ???
         * Refunds per User - ???
         */

        const reportData = {
          title: `${office.officeName} -- General Report`,
          date: `${Moment.months(new Moment().month())} ${new Moment().format('YYYY')}`,
          totalMembers: memberRecords.length,
          office,
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

        // TODO: Continue to prepare the necessary information
        const report = nunjucks.renderString(generalTemplate, reportData);
        const downloadFilename = `${reportData.title.split(' ').join('-')}_${report.date}.pdf`;

        pdf.create(report, { format: 'Letter' }).toBuffer((err, resp) => {
          if (err) { res.json(new BadRequestError(err)); }
          res.setHeader('Content-disposition', `attachment; filename=${downloadFilename}`);
          res.writeHead(200, { 'Content-Type': 'application/pdf' });
          res.write(resp);
          res.end();
        });
      });
    } else {
      // Forbidden: Current user lacks credentials
      res.json(new ForbiddenError('Requested Dentist Office does not access or user does not have appropriate access'));
    }
  }).catch(err => res.json(new BadRequestError(err)));
}

/**
 * Retrieves a master report on all dentist offices
 *
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getMasterReport(req, res, next) {
  const month = Moment.monthsShort()[req.params.month];

  db.DentistInfo.findAll({
    include: [
      { model: db.User, as: 'user' },
      { model: db.Membership, as: 'childMembership' },
      { model: db.Membership, as: 'membership' }
    ]
  }).then(offices => {
    // Collect office reports
    Promise.all(offices.map(office => new Promise((resolve, reject) => {
      // Validate the current user has the proper authorization to see this report
      db.Subscription.findAll({
        where: { dentistId: office.user.id },
        include: [{
          model: db.User,
          as: 'client',
        }, {
          model: db.Membership,
          as: 'membership',
        }],
      }).then(members => {
        // Calculate gross revenue and prepare member records
        const gross = members.reduce((sum, m) => {
          let fee = 0;

          if (office.acceptsChildren && m.membership.childYearlyFeeActivated) {
            // Child pricing
            fee = parseInt(office.childMembership.monthly, 10);
          } else {
            // Adult pricing
            fee = parseInt(office.membership.monthly, 10);
          }

          return (sum + fee);
        }, 0);

        const managementFee = (gross * 0.11);

        resolve({ officeName: office.officeName, gross, managementFee, net: (gross - managementFee) });
      }).catch(err => reject(err));
    }))).then(officeReports => {
      // Calculate totals
      const totals = officeReports.reduce((t, office) => {
        t.gross += office.gross;
        t.managementFee += office.managementFee;
        t.net += office.net;
        return t;
      }, {
        gross: 0,
        managementFee: 0,
        net: 0,
      });

      // Round off the totals
      totals.gross = Number(totals.gross.toFixed(2));
      totals.managementFee = Number(totals.managementFee.toFixed(2));
      totals.net = Number(totals.net.toFixed(2));

      // Fetch the master template file
      const masterTemplate = fs.readFileSync(
        path.resolve(`${__dirname}/../../views/reports/master-report.html`),
        'utf8'
      );

      // Compose the master report
      const report = nunjucks.renderString(masterTemplate, {
        datePeriod: `${month} ${req.params.year}`,
        records: officeReports,
        totals,
      });

      // Send PDF file
      pdf.create(report, { format: 'Letter' }).toBuffer((err, resp) => {
        if (err) { res.json(new BadRequestError(err)); }
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.write(resp);
        res.end();
      });
    });
  }).catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/dentist/:officeId/list')
  .get(userRequired, dentistRequired, injectDentistOffice('officeId'), getListOfReportURLs);

router.route('/dentist/:officeId/:year/:month/general')
  .get(userRequired, dentistRequired, getGeneralReport);

router.route('/dentists/:year/:month')
  .get(userRequired, adminRequired, getMasterReport);

export default router;
