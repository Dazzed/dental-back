// TODO: update with real data before go production
export const DEFAULT_MEMBERSHIPS = [{
  name: 'First Membership',
  description: 'Here goes the description',
  price: '300.00',
}, {
  name: 'Second Membership',
  description: 'Here goes the description',
  price: '300.99',
}];

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

export default {
  SEX_TYPES,
  PREFERRED_CONTACT_METHODS,
  USER_TYPES,
  EMAIL_SUBJECTS,
};
