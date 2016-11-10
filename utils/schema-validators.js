import {
  SEX_TYPES,
  // PREFERRED_CONTACT_METHODS,
  MEMBER_RELATIONSHIP_TYPES,
} from '../config/constants';


export const NORMAL_USER_EDIT = {
  email: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
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
  // contactMethod: {
  //   isIn: {
  //     options: [Object.keys(PREFERRED_CONTACT_METHODS)],
  //   },
  // },
};


export const NORMAL_USER_REGISTRATION = {
  email: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
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
  sex: {
    isIn: {
      options: [Object.keys(SEX_TYPES)],
    },
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
  // tos: {
  //   notEmpty: true,
  // },
  dentistId: {
    notEmpty: true,
    existsInDB: {
      options: ['User', 'id', { type: 'dentist' }],
      errorMessage: 'Dentist does not exists',
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
  email: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
  },
  specialtyId: {
    notEmpty: true,
    existsInDB: {
      options: ['DentistSpecialty', 'id'],
      errorMessage: 'Specialty does not exists',
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
  phone: {
    notEmpty: true,
  },
  zipCode: {
    notEmpty: true,
  },
  tos: {
    notEmpty: true,
  },
};


export const MEMBERSHIP = {
  name: {
    notEmpty: true,
  },
  price: {
    notEmpty: true,
    isCurrency: true,
  }
};


export const MESSAGE = {
  message: {
    notEmpty: true,
  },
};


export const REVIEW = {
  title: {
    notEmpty: true,
  },
  review: {
    notEmpty: true,
  },
};

export const INVITE_PATIENT = {
  email: {
    notEmpty: true,
  },
};

export const CONTACT_SUPPORT = {
  message: {
    notEmpty: true,
  }
};
