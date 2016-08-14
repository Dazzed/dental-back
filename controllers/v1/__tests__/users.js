/* eslint-disable  import/no-extraneous-dependencies */
import request from 'supertest';
import HTTPStatus from 'http-status';
import factory from 'factory-girl';
import { should } from 'chai';
import jwt from 'jsonwebtoken';
/* eslint-enable  import/no-extraneous-dependencies */

import app from '../../../index.js';
import db from '../../../models';

import './factories';

should();

const API_BASE = '/api/v1';
const agent = request(app);
let jwtToken;


before((done) => {
  const user = factory.buildSync('user').toJSON();
  user.phone = '732-757-2923';
  user.address = 'This is the address';
  user.tos = true;
  user.confirmPassword = user.password = 'thisPassword43';
  user.confirmEmail = user.email;

  agent
    .post(`${API_BASE}/accounts/signup`)
    .send(user)
    .end((err) => {
      if (err) {
        return done(err);
      }

      return agent
      .post(`${API_BASE}/accounts/login`)
        .send({ email: user.email, password: user.password })
        .end((_err, res) => {
          if (_err) {
            return done(_err);
          }

          jwtToken = jwt.sign({ id: res.body.id }, process.env.JWT_SECRET);
          return done();
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

  it('Returns user', (done) => {
    agent
      .get(`${API_BASE}/users/me`)
        .set('Authorization', `JWT ${jwtToken}`)
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          Object.keys(res.body).length.should.equal(20);
          return done();
        });
  });
});
