/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';

import passport from 'passport';

import db from '../models';
import { instance as UserInstance } from '../orm-methods/users';
import { fetchDentist } from '../orm-methods/dentists';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from './errors';

// ────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE

/**
 * Middleware that request if user is admin to allow next middleware.
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} res - the next middleware function
 */
export function adminRequired(req, res, next) {
  if (req.user && req.user.type === 'admin') {
    return next();
  }

  return res.json({ error: new ForbiddenError('administrative user is required') });
}

/**
 * Middleware that request if user is admin to allow next middleware and
 * injects the dentist object into the request
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} res - the next middleware function
 */
export function dentistRequired(req, res, next) {
  if (req.user && (req.user.type === 'dentist' || req.user.type === 'admin')) {
    next();
  } else {
    res.json({ error: new ForbiddenError() });
  }
}

/**
 * Injects the complete dentist object with necessary pricing and calculated costs
 *
 * @param {string} [paramName='dentistId'] - the url param name to find the dentist id
 * @param {any} [localVarName='dentist'] - where the dentist object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectDentist(paramName = 'dentistId', localVarName = 'dentist') {
  return (req, res, next) => {
    fetchDentist(req.params[paramName])
      .then((dentist) => {
        req.locals[localVarName] = dentist;
        next();
      })
      .catch(err => next(new BadRequestError(err)));
  };
}

/**
 * Fills the request with the dentist information from
 * the requested member found in the url params
 *
 * @param {string} [userParamName='userId'] - the url param name to find the user id
 * @param {string} [dentistInfoParamName='dentistInfoId'] - the url param name to find the dentist info id
 * @param {string} [localVarName='dentistInfo'] - where the dentist object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectDentistInfo(userParamName = 'userId', dentistInfoParamName = 'dentistInfoId', localVarName = 'dentistInfo') {
  return (req, res, next) => {
    const userId = req.params[userParamName];

    /*
    * If user is not admin and try to requests paths not related
    * to that user will return forbidden.
    */
    const canEdit =
      userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
      (req.user.get('type') === 'admin' && userId !== 'me');

    if (!canEdit) {
      return next(new ForbiddenError());
    }

    const query = {
      where: {},
      attributes: {
        exclude: ['userId'],
      },
      include: [{
        model: db.WorkingHours,
        as: 'workingHours',
        attributes: { exclude: ['dentistInfoId'] },
        orderBy: 'createdAt DESC',
      }, {
        model: db.MembershipItem,
        as: 'pricing',
        attributes: {
          exclude: ['dentistInfoId']
        }
      }, {
        model: db.Membership,
        as: 'memberships',
        attributes: {
          exclude: ['userId', 'dentistInfoId', 'stripePlanId'],
        },
      }, {
        model: db.DentistInfoService,
        as: 'services',
        attributes: {
          exclude: ['serviceId', 'dentistInfoId']
        },
        include: [{
          model: db.Service,
          as: 'service',
          raw: true
        }]
      }, {
        model: db.DentistInfoPhotos,
        as: 'officeImages',
        attributes: ['url', 'id']
      }],
      // Confused as to what the ordering should be here.
      // Should the orderign be based on the id of the memberships?
      // Wouldn't that be automatic?
      // order: [
      //   [
      //     { model: db.Membership, as: 'membership' },
      //     'id', 'asc'
      //   ],
      //   [
      //     { model: db.Membership, as: 'childMembership' },
      //     'id', 'asc'
      //   ]
      // ]
    };

    if (req.params.dentistInfoId) {
      query.where.id = parseInt(req.params[dentistInfoParamName]);
    }

    // if not admin limit query to related data userId
    if (req.user.get('type') !== 'admin') {
      query.where.userId = req.user.get('id');
    }

    return db.DentistInfo.find(query).then((dentistInfo) => {
      if (!dentistInfo) {
        return next(new NotFoundError("no dentist info found."));
      }

      req.locals[localVarName] = dentistInfo;

      return next();
    }).catch((error) => {
      next(error);
    });
  };
}

/**
 * Injects the dentist office object into the request
 *
 * @param {string} [paramName='dentistId'] - the url param name to find the office id
 * @param {string} [localVarName='dentist'] - where the dentist object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectDentistOffice(paramName = 'dentistId', localVarName = 'dentist') {
  return (req, res, next) => {
    let paramVal = req.params[paramName];
    if (req.params[paramName] === 'me') {
      paramVal = req.user.get('id');
    }
    UserInstance.getFullDentist(paramVal).then((dentist) => {
      req.locals[localVarName] = dentist;
      next();
    }).catch(err => new BadRequestError(err));
  };
}

/**
 * Injects the membership user object into the request object
 *
 * @param {string} [paramName='userId'] - the url param name to find the user id
 * @param {string} [localVarName='membershipUser'] - where the user object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectSimpleUser(paramName = 'userId', localVarName = 'membershipUser') {
  return (req, res, next) => {
    let id = req.params[paramName];

    if (id === 'me') id = req.user.get('id');

    Promise.resolve()
      .then(() => db.User.find({ where: { id } }))
      .then((user) => {
        if (!user || req.params[paramName] !== 'me') next(new BadRequestError());
        req.locals[localVarName] = user;
        next();
      }).catch((err) => {
        console.log(err);
        next(new BadRequestError());
      });
  };
}

/**
 * Injects the user object into the request
 *
 * @param {string} [paramName='userId'] - the url param name to find the user id
 * @param {string} [localVarName='user'] - where the user object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectUser(paramName = 'userId', localVarName = 'user') {
  return (req, res, next) => {
    const userId = req.params[paramName];

    if (userId === 'me' || (req.user && req.user.get('id') === parseInt(userId, 10))) {
      req.locals[localVarName] = req.user;
      return next();
    }

    // code in the if block will never execute given the condition above.
    if (req.user && req.user.get('type') === 'client' && userId === 'me') {
      return next(new ForbiddenError());
    }

    let accountOwner;

    if (req.user && req.user.get('type') === 'client') {
      accountOwner = req.user.get('id');
    }

    return db.User.getActiveUser(userId, accountOwner).then((user) => {
      if (!user) next(new NotFoundError());
      else {
        req.locals[localVarName] = user;
        next();
      }
    }).catch((error) => {
      next(error);
    });
  };
}

/**
 * Injects the user's memnbership record into req.locals for processing
 *
 * @param {string} [membershipParamName='membershipId'] - the ur param name to find the membership id
 * @param {string} [localVarName='membership'] - where the membership object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectMembership(membershipParamName = 'membershipId', localVarName = 'membership') {
  return (req, res, next) => {
    let membership = {};

    db.Membership.find({
      id: req.params[membershipParamName],
    })
      .then((mem) => {
        if (!mem) throw new Error('Membership does not exist!');
        membership = mem.toJSON();
        return mem.getPlanCosts();
      })
      .then((planCosts) => {
        membership = Object.assign({}, membership, planCosts);
        membership = _(membership).omit(['stripePlanId', 'userId', 'price']);
        req.locals[localVarName] = membership;
        next();
      })
      .catch(err => next(err));
  };
}

/**
 * Injects the dentist's memnbership record into req.locals for processing
 *
 * @param {string} [membershipParamName='membershipId'] - the url param name to find the membership id
 * @param {string} [dentistParamName='dentistId'] - the url param name to find the dentist id
 * @param {string} [localVarName='membership'] - where the membership object will be stored in req.locals
 * @returns {Function} - the middleware function
 */
export function injectDentistMembership(membershipParamName = 'membershipId', dentistParamName = 'dentistId', localVarName = 'membership') {
  return (req, res, next) => {
    let membership = {};

    db.Membership.find({
      id: req.params[membershipParamName],
      userId: req.params[dentistParamName],
    })
      .then((mem) => {
        if (!mem) throw new Error('Membership does not exist!');
        membership = mem.toJSON();
        return mem.getPlanCosts();
      })
      .then((planCosts) => {
        membership = Object.assign({}, membership, planCosts);
        membership = _(membership).omit(['stripePlanId', 'userId', 'price']);
        req.locals[localVarName] = membership;
        next();
      })
      .catch(err => next(err));
  };
}

/**
 * Injects the associated member record found into the request
 *
 * @param {string} [memberParamName='memberId'] - the url param name to find the member id
 * @param {string} [userParamName='userId'] - the url param name to find the user id
 * @param {string} [localVarName='member'] - where the membership object will be stored into on req.locals
 * @returns {Function} - the middleware function
 */
export function injectMemberFromUser(memberParamName = 'memberId', userParamName = 'userId', localVarName = 'member') {
  return (req, res, next) => {
    const memberId = req.params[memberParamName];
    const userId = req.params[userParamName];
    const addedBy = userId === 'me' ? req.user.get('id') : userId;

    db.User.getMyMember(addedBy, memberId).then((member) => {
      if (!member) {
        return next(new NotFoundError());
      }

      req.locals[localVarName] = member;
      return next();
    }).catch(error => next(error));
  };
}

/**
 * Injects the subscribed patient request of the dentist office into the request
 *
 * @param {string} [patientParamName='patientId'] - the url param name to find the patient id
 * @param {string} [localVarName='client'] - where the patient object will be stored on req.locals
 * @returns {Function} - the middleware function
 */
export function injectSubscribedPatient(patientParamName = 'patientId', localVarName = 'client') {
  return (req, res, next) => {
    db.Subscription.findOne({
      where: {
        clientId: req.params[patientParamName],
        dentistId: req.user.get('id')
      },
      include: [{
        model: db.User,
        as: 'client',
        attributes: {
          exclude: ['resetPasswordKey', 'salt', 'activationKey', 'verified']
        }
      }]
    })
      .then((subscription) => {
        if (!subscription || !subscription.get('client')) next(new NotFoundError());
        req.locals[localVarName] = subscription.get('client');
        next();
      })
      .catch(err => next(new BadRequestError(err)));
  };
}

/**
 * Verifies a user's password in the request body
 *
 * @param {string} [paramName='oldPassword'] - the url param name to find the user's password
 * @returns {Function} - the middleware function
 */
export function verifyPasswordLocal(paramName = 'oldPassword') {
  return (req, res, next) => {
    db.User.find({
      where: { id: req.locals.user.get('id') }
    })
      .then((_user) => {
        const password = req.body[paramName];

        _user.authenticate(password, (err, user) => {
          if (err) return next(err);

          if (!user) {
            return next(new UnauthorizedError('Incorrect password.'));
          }
          req.locals.passwordVerified = true;
          return next();
        });
      });
  };
}

/**
 * Middleware to check if the user is logged in
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} res - the next middleware function
 */
export function userRequired(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err || user == null || user === false) {
      res.json({ data: { error: 'Failed to authenticate' } });
    } else {
      req.user = user;
      next();
    }
  })(req, res, next);
}

/**
 * Validates the body of a request based on the provided schema
 *
 * @param {Object} [schemaObject={}] - the body content to validate
 * @param {Function} [bodyPrepCb=body=>body] - a callback to prepare the body before validating
 * @returns {Function} - the middleware function
 */
export function validateBody(schemaObject = {}, bodyPrepCb = body => body) {
  return (req, res, next) => {
    const temp = req.body;
    req.body = bodyPrepCb(req.body);
    req.checkBody(schemaObject);
    req.body = temp;

    req.asyncValidationErrors(true)
      .then(next, (err) => {
        next(new BadRequestError(err));
      });
  };
}

/**
 * Validates the body of a request based on the provided schema
 *
 * @param {Object} [schemaObject={}] - the body content to validate
 * @param {Function} [paramsPrepCb=params=>params] - a callback to prepare the params before validating
 * @returns {Function} - the middleware function
 */
export function validateParams(schemaObject = {}, paramsPrepCb = params => params) {
  return (req, res, next) => {
    const temp = req.body;
    req.body = paramsPrepCb(req.body);
    req.checkParams(schemaObject);
    req.body = temp;

    req.asyncValidationErrors(true)
      .then(next, (err) => {
        next(new BadRequestError(err));
      });
  };
}

/**
 * Checks if the current logged in user is allowed to modify
 * payment information on the requested user object
 *
 * @param {string} [userParamName='userId'] - the param to use for finding the requested user id
 * @param {string} [localUserVarName='user'] - where to store the user variable
 * @param {string} [localSubVarName='subscription'] - where to store the requested user subscription
 * @param {string} [localPayVarName='paymentProfile'] - where to store the payment profile of the requested user
 * @returns {Function} - the middleware function
 */
export function validatePaymentManager(userParamName = 'userId', localUserVarName = 'user', localSubVarName = 'subscription', localPayVarName = 'paymentProfile') {
  return (req, res, next) => {
    const sessionUserId = req.locals.user.get('id');
    const requestedUserId = req.params[userParamName];
    let isDentist = false;

    db.User.find({ where: { id: requestedUserId } })
      .then((user) => {
        if (!user) throw new Error('Requested user does not exist');
        req.locals[localUserVarName] = user;
        return db.Subscription.find({ where: { clientId: requestedUserId } });
      })
      .then((sub) => {
        // Validate the user has an active subscription
        // or current session user is the dentist owner

        //352 - If primary account holder is not a member I get an error
        // if (!sub) throw new Error('User has no valid subscription');

        req.locals[localSubVarName] = sub || null;
        // Get the users payment profile next
        if (sub) {
          if (sessionUserId === sub.dentistId) isDentist = true;
          return db.PaymentProfile.find({ where: { id: sub.paymentProfileId } });
        }
        else {
          return db.PaymentProfile.find({ where: { primaryAccountHolder: requestedUserId } });
        }
      })
      .then((profile) => {
        // Validate the access (only primary account holder and user's dentist is allowed)
        if ((sessionUserId !== profile.primaryAccountHolder) && !isDentist) {
          throw new Error('User does not have access to this user account');
        }
        req.locals[localPayVarName] = profile;
        next();
      })
      .catch(err => next(new BadRequestError(err)));
  };
}
