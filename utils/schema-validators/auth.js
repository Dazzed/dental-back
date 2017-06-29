'use strict';

import _ from 'lodash';

import {
  DENTIST_USER
} from './user';

export const DENTIST_SIGNUP = _.merge({},
  _.mapKeys(DENTIST_USER, (value, key) => {
    return 'user.' + key;
  })
);