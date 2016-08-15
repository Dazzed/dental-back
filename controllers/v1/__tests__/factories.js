/* eslint-disable  import/no-extraneous-dependencies */
import factory from 'factory-girl';
import adapter from 'factory-girl-sequelize';
/* eslint-enable  import/no-extraneous-dependencies */

import db from '../../../models';
import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  MEMBER_RELATIONSHIP_TYPES,
} from '../../../config/constants';


adapter();


factory.define('user', db.User, {
  email: factory.sequence((n) => `user${n}@demo.com`),
  firstName: 'First name',
  lastName: 'Last name',
  birthDate: () => new Date(),
  city: 'City',
  state: 'State',
  zipCode: 'Zip code',

  sex() {
    const options = Object.keys(SEX_TYPES);
    return options[Math.floor(Math.random() * options.length)];
  },

  contactMethod() {
    const options = Object.keys(PREFERRED_CONTACT_METHODS);
    return options[Math.floor(Math.random() * options.length)];
  }
});


factory.define('familyMember', db.FamilyMember, {
  email: factory.sequence((n) => `familyMember${n}@demo.com`),
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'phone',
  birthDate: () => new Date(),

  familyRelationship() {
    const options = Object.keys(MEMBER_RELATIONSHIP_TYPES);
    return options[Math.floor(Math.random() * options.length)];
  },
});


factory.define('dentistSpecialty', db.DentistSpecialty, {
  name: factory.sequence((n) => `Specialty ${n}`),
});
