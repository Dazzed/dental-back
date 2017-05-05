/* eslint max-len: 0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import { Router } from 'express';
import Moment from 'moment';
import pdf from 'html-pdf';
import nunjucks from 'nunjucks';
import passport from 'passport';

import db from '../../models';
import {
  instance as UserInstance,
} from '../../orm-methods/users.js';

import {
  BadRequestError,
  ForbiddenError
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// TEMPLATES

nunjucks.configure('../../views');

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

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
        memberRecords.filter(m => isNaN(parseInt(m.member.client.addedBy, 10))).forEach(m => {
          const parent = parentMemberRecords[m.member.client.addedBy];
          if (parent !== undefined) {
            parentMemberRecords[m.member.client.addedBy].family.push(m);
          }
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
          office,
          memberRecords,
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

        pdf.create(report, { format: 'Letter' }).toBuffer((err, resp) => {
          if (err) { res.json(new BadRequestError(err)); }
          res.writeHead(200, { 'Content-Type': 'application/pdf' });
          res.write(resp);
          res.end();
        });

        // res.json({ user: req.user, office, members, reportData });
      });
    } else {
      // Forbidden: Current user lacks credentials
      res.json(new ForbiddenError('Requested Dentist Office does not access or user does not have appropriate access'));
    }
  }).catch(err => res.json(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

const router = new Router({ mergeParams: true });

router.route('/dentist/:officeId/general').get(passport.authenticate('jwt', { session: false }), getGeneralReport);

export default router;
