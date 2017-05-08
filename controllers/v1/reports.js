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
 * Retrieves a PDF report for a dentist
 *
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getDentistReport(req, res) {}

/**
 * Retrieves a PDF report for general membership/costs
 * information about the members of a dentist office
 *
 * @param {Object<any>} req - the express request
 * @param {Object<any>} res - the express response
 */
function getGeneralReport(req, res) {
  const reportEndDate = new Moment();
  reportEndDate.date(1).subtract(1, 'day');

  // TODO: restrict to dentists/admins
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

    console.log(req.user.id, office.user.id);

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
         * Refunds
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
function getMasterReport(req, res) {}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/dentist/:officeId').get(userRequired, dentistRequired, getDentistReport);
router.route('/dentist/:officeId/general').get(userRequired, adminRequired, getGeneralReport);
router.route('/dentists').get(userRequired, adminRequired, getMasterReport);

export default router;