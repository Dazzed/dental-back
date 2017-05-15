export const USER_ORIGIN_OPTIONS = ['external', 'internal'];

// TODO: update with real data before go production
export const ADULT_MEMBERSHIP_ITEMS_DEFAULTS = [{
  code: '1110',
}, {
  code: '0150'
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


export const CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS = [{
  code: '0150',
}, {
  code: '1120'
}, {
  code: '0120',
}, {
  code: '4910',
}, {
  code: '1206'
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
  phone: 'Phone',
  email: 'Email',
};


export const USER_TYPES = {
  admin: 'Admin',
  client: 'Client',
  dentist: 'Dentist',
};


export const MEMBER_RELATIONSHIP_TYPES = {
  partner: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
};


export const CONTACT_SUPPORT_EMAIL = 'info@dentalhq.com';


export const EMAIL_SUBJECTS = {
  client: {
    welcome: 'Welcome to the Dental Marketplace!',
  },
  dentist: {
    activation_required: 'Activate Your Account',
    invite_patient: 'Invitation to join',
    new_patient: 'New Patient from DentalHQ',
    new_review: 'You Have a New Review on DentalHQ'
  },
  activation_complete: 'Welcome to the Dental Marketplace!',
  contact_support: 'A New DentalHQ.com Contact Form Message',
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


export const US_STATES = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

export const EDIT_USER_BY_ADMIN = [
  'firstName',
  'middleName',
  'lastName',
  'email',
  'phoneNumber'
];

/**
 * Pricing Codes related to calculating the full cost of a membership
 */
export const CODES_FOR_CALC_FULL_COST = [
  '1110',
  '0120',
  '0274',
  '0330',
  '0220',
  '0140',
];

export const AUTHORIZE_HOOK_EVENTS = {
  REFUND_CREATED: 'net.authorize.payment.refund.created',
  SUBSCRIPTION_SUSPENDED: 'net.authorize.customer.subscription.suspended',
  SUBSCRIPTION_TERMINATED: 'net.authorize.customer.subscription.terminated',
  SUBSCRIPTION_CANCELLED: 'net.authorize.customer.subscription.cancelled',
};
