import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  MEMBER_RELATIONSHIP_TYPES,
  USER_ORIGIN_OPTIONS,
  SUBSCRIPTION_TYPES,
} from '../config/constants';


export const PATIENT_CARD_UPDATE = {
  periodontalDiseaseWaiver: { notEmpty: true },
  reEnrollmentFeeWaiver: { notEmpty: true },
  termsAndConditions: { notEmpty: true },
  stripeToken: { notEmpty: true }
};


export const NEW_EMAIL_VALIDATOR = {
  newEmail: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
  },
  confirmNewEmail: {
    isEmail: true,
    notEmpty: true
  }
};


export const NEW_PASSWORD_VALIDATOR = {
  newPassword: {
    notEmpty: true,
    matches: {
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d$/*!]{6,}$/]
    },
    errorMessage: 'Password should have at least 6 '
                  + 'characters, upper case, lower case and numbers.'
  },
  confirmNewPassword: {
    notEmpty: true
  }
};

export const NORMAL_USER_EDIT = {
  newEmail: {
    notEmpty: true,
    isEmail: true,
    isDBUnique: {
      options: ['User', 'email'],
      errorMessage: 'This email is in use.'
    }
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
  newPassword: {
    notEmpty: true,
    matches: {
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d$/*!]{6,}$/]
    },
    errorMessage: 'Password should have at least 6 characters, upper case, lower case and numbers.'
  },
  confirmNewPassword: {
    notEmpty: true,
  }
};

export const PATIENT_EDIT = {
  phone: {
    notEmpty: true,
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
    }
  }
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
  phone: {
    notEmpty: true,
    isDBUnique: {
      options: ['Phone', 'number'],
      errorMessage: 'This phone number is in use.'
    }
  },
  firstName: {
    notEmpty: true,
  },
  lastName: {
    notEmpty: true,
  },
  password: {
    notEmpty: true,
    matches: {
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d$/*!]{6,}$/]
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
  origin: {
    notEmpty: true,
    isIn: {
      options: [USER_ORIGIN_OPTIONS],
    },
  }
};


export const COMPLETE_NORMAL_USER_REGISTRATION = {
  birthDate: {
    notEmpty: true,
    isDate: true,
  },
  sex: {
    isIn: {
      options: [Object.keys(SEX_TYPES)],
    },
  },
  officeId: {
    notEmpty: true,
    existsInDB: {
      options: ['DentistInfo', 'id'],
      errorMessage: 'Dentist office does not exists',
    }
  },
  phone: {
    notEmpty: true,
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
};

export const MANAGER_REGISTRATION = {
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
  phone: {
    notEmpty: true,
  },
};

export const MANAGER_UPDATE= {
  email: {
    notEmpty: true,
    isEmail: true,
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
  id: {
    notEmpty: true
  }
};

export const ADD_MEMBER = {
  'member.firstName': {
    notEmpty: true,
  },
  'member.lastName': {
    notEmpty: true,
  },
  'member.birthDate': {
    notEmpty: true,
    isDate: true,
  },
  'member.sex': {
    notEmpty: true
  },
  'member.familyRelationship': {
    notEmpty: true,
    isIn: {
      options: [Object.keys(MEMBER_RELATIONSHIP_TYPES)],
    },
  },
};

export const MEMBER = {
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
    notEmpty: true
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
      options: [/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d$/*!]{6,}$/]
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


export const MEMBERSHIP_FIELDS = {
  name: {
    optional: true,
  },
  description: {
    optional: true,
  },
  discount: {
    optional: true,
  },
  type: {
    optional: true,
    isIn: {
      options: SUBSCRIPTION_TYPES,
    },
    errorMessage: 'Invalid Membership type provided (i.e. month, year, etc)',
  },
  price: {
    optional: true,
  },
};


export const MESSAGE = {
  message: {
    notEmpty: true,
  },
};


export const REVIEW = {
  message: {
    notEmpty: true,
  },
  rating: {
    notEmpty: true
  }
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

export const UPDATE_DENTIST = {
  email: {
    notEmpty: true,
    isEmail: true,
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
};

export const NEW_PRICING_CODE = {
  description: {
    notEmpty: true,
  },
  code: {
    notEmpty: true,
  }
};

export const STRIPE_TOKEN = {
  token: {
    notEmpty: true,
  }
};

export const REFUND_POST_PARAMS = {
  userId: {
    notEmpty: true,
  },
  refundAmount: {
    notEmpty: true,
  },
};
