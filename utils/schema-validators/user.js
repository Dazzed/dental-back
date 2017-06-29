'use strict';

import _ from 'lodash';

export const USER = {
  'email': {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
  },
  'confirmEmail': {
    isEmail: true,
    notEmpty: true,
  },
  'password': {
    notEmpty: true,
    matches: {
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d$/*!]{6,}$/]
    },
    errorMessage: 'Password should have at least 6 characters, upper case, lower case and numbers.'
  },
  'confirmPassword': {
    notEmpty: true,
  },
  'firstName': {
    notEmpty: true,
  },
  'lastName': {
    notEmpty: true,
  },
  'phone': {
    notEmpty: true,
    isDBUnique: {
      options: ['Phone', 'number'],
      errorMessage: 'This phone number is in use.'
    }
  }
};

export const DENTIST_USER = _.assign({
  'specialtyId': {
    notEmpty: true,
    existsInDB: {
      options: ['DentistSpecialty', 'id'],
      errorMessage: 'Specialty does not exists',
    }
  },
  'zipCode': {
    optional: true,
    notEmpty: true
  },
  'city': {
    optional: true,
    notEmpty: true
  },
  'address': {
    optional: true,
    notEmpty: true
  }
}, USER);