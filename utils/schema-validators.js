import {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  MEMBER_RELATIONSHIP_TYPES,
  USER_ORIGIN_OPTIONS
} from '../config/constants';


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


export const WAIVE_CANCELLATION = {
  cancellationFee: {
    notEmpty: true,
    errorMessage: 'You must set whether you want '
                  + 'to charge cancellation fee for this patient.'
  },
  reEnrollmentFee: {
    notEmpty: true,
    errorMessage: 'You must set whether you want '
                  + 'to charge re-enrollment fee for this patient.'
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
      options: USER_ORIGIN_OPTIONS,
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
  // tos: {
  //   notEmpty: true,
  // },
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
  message: {
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
