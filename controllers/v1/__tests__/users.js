/* eslint-disable  import/no-extraneous-dependencies */
import request from 'supertest';
import HTTPStatus from 'http-status';
import factory from 'factory-girl';
import { should } from 'chai';
/* eslint-enable  import/no-extraneous-dependencies */

import app from '../../../index.js';
import db from '../../../models';

import './factories';

should();

const API_BASE = '/api/v1';
const agent = request(app);
let jwtToken;


const user = factory.buildSync('user').toJSON();
user.tos = true;
user.confirmPassword = user.password = 'thisPassword43';
user.confirmEmail = user.email;


before((done) => {
  agent
    .post(`${API_BASE}/accounts/signup`)
    .send(user)
    .end((err) => {
      if (err) {
        return done(err);
      }

      return db.User.find({ where: { type: 'client', email: user.email } })
        .then((fetched) => {
          agent
            .get(`${API_BASE}/accounts/activate/${fetched.get('activationKey')}`)
            .end((activationError) => {
              if (activationError) {
                return done(activationError);
              }
              return agent
                .post(`${API_BASE}/accounts/login`)
                .send({ email: user.email, password: user.password })
                .end((_err, res) => {
                  if (_err) {
                    return done(_err);
                  }

                  jwtToken = res.body.token;
                  return done();
                });
            });
        });
    });
});


after((done) => {
  db.User.destroy({ where: { type: 'client' } }).then(() => done());
});


describe('Get me user', () => {
  it('Returns unautorized', (done) => {
    agent
      .get(`${API_BASE}/users/me`)
      .expect(HTTPStatus.UNAUTHORIZED)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('Forbidden access', (done) => {
    agent
      .get(`${API_BASE}/users/0`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.FORBIDDEN)
      .end((err) => {
        if (err) {
          return done(err);
        }

        return done();
      });
  });

  it('Returns user', (done) => {
    agent
      .get(`${API_BASE}/users/me`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.data).length.should.equal(16);
        return done();
      });
  });

  it('Update user', (done) => {
    const updatedUser = Object.assign({}, user, {
      firstName: 'new first name',
      phone: '732-757-2924',
      address: 'This is the new address',
    });

    agent
      .put(`${API_BASE}/users/me`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(updatedUser)
      .expect(HTTPStatus.OK)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.data).length.should.equal(16);
        res.body.data.phoneNumbers[0].number.should.equal(updatedUser.phone);
        res.body.data.addresses[0].value.should.equal(updatedUser.address);
        res.body.data.firstName.should.equal(updatedUser.firstName);
        return done();
      });
  });

  it('Delete user', (done) => {
    agent
      .delete(`${API_BASE}/users/me`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((err) => {
        if (err) {
          return done(err);
        }

        return db.User.findOne({ where: { isDeleted: true, email: user.email } })
          .then((fetchedUser) => {
            fetchedUser.get('isDeleted').should.be.a('boolean');
            fetchedUser.get('isDeleted').should.equal(true);
            return done();
          });
      });
  });
});
