// TODO: update with real data before go production
export const MEMBERSHIP_ITEMS_DEFAULTS = [{
  code: '1110',
}, {
  code: '1120'
}, {
  code: '0120',
}, {
  code: '4910',
}, {
  code: '1208'
}, {
  code: '0274',
}, {
  code: '0272',
}, {
  code: '0210'
}, {
  code: '0330',
}, {
  code: '0140',
}, {
  code: '0220',
}];


export const DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];


export const SEX_TYPES = {
  M: 'Male',
  F: 'Female',
};


export const PREFERRED_CONTACT_METHODS = {
  office: 'I will contact the office',
};


export const USER_TYPES = {
  admin: 'Admin',
  client: 'Client',
  dentist: 'Dentist',
};


export const MEMBER_RELATIONSHIP_TYPES = {
  partner: 'Partner',
  son: 'Son',
  daughter: 'Daughter',
};


export const EMAIL_SUBJECTS = {
  client: {
    signup: 'Welcome',
  },
  dentist: {
    signup: 'Welcome',
  }
};


export const SUBSCRIPTION_STATES = [
  'active',
  'canceled',
  'inactive',
  'past_due',
];


export const RECOMMENDED_DISCOUNT = 25;


export default {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  USER_TYPES,
  EMAIL_SUBJECTS,
};
