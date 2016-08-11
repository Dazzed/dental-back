import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  MEMBER_RELATIONSHIP_TYPES,
} from '../config/constants';


export const NORMAL_USER_REGISTRATION = {
  email: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
  },
  password: {
    notEmpty: true,
    matches: {
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\$\/\*!]{6,}$/]
    },
    errorMessage: 'Password should have at least 6 characters, upper case, lower case and numbers.'
  },
  confirmPassword: {
    notEmpty: true,
  },
  confirmEmail: {
    isEmail: true,
    notEmpty: true,
  },
  firstName: {
    notEmpty: true,
  },
  lastName: {
    notEmpty: true,
  },
  birthDate: {
    notEmpty: true,
    isDate: true,
  },
  phone: {
    notEmpty: true,
  },
  sex: {
    isIn: {
      options: [Object.keys(SEX_TYPES)],
    },
  },
  address: {
    notEmpty: true,
  },
  city: {
    notEmpty: true,
  },
  state: {
    notEmpty: true,
  },
  zipCode: {
    notEmpty: true,
  },
  contactMethod: {
    isIn: {
      options: [Object.keys(PREFERRED_CONTACT_METHODS)],
    },
  },
  tos: {
    notEmpty: true,
  },
  familyMembers: {
    checkFamilyMembers: {
      errorMessage: 'Invalid values for some family member',
    }
  }
};


export const FAMILY_MEMBER = {
  firstName: {
    notEmpty: true,
  },
  lastName: {
    notEmpty: true,
  },
  birthDate: {
    notEmpty: true,
    isDate: true,
  },
  phone: {
    notEmpty: true,
  },
  email: {
    notEmpty: true,
    isEmail: true,
  },
  familyRelationship: {
    notEmpty: true,
    isIn: {
      options: [Object.keys(MEMBER_RELATIONSHIP_TYPES)],
    },
  },
};


export const DENTIST_USER_REGISTRATION = {

};

