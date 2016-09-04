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


describe('Normal user signup', () => {
  it('Return required fields and valid formats', (done) => {
    agent
      .post(`${API_BASE}/accounts/signup`)
      .expect('Content-Type', /json/)
      .expect(HTTPStatus.BAD_REQUEST)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // Should be an array of 15 elements
        Object.keys(res.body.errors).should.have.length(9);
        return done();
      });
  });

  it('Successful signup', (done) => {
    const user = factory.buildSync('user').toJSON();

    user.tos = true;
    user.confirmPassword = user.password = 'thisPassword43';
    user.confirmEmail = user.email;
    user.birthDate = new Date();

    agent
      .post(`${API_BASE}/accounts/signup`)
        .send(user)
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.CREATED)
        .end((err) => {
          if (err) {
            return done(err);
          }

          return db.User.findOne({
            where: { type: 'client', email: user.email },
            include: [
              { model: db.Address, as: 'addresses' },
              { model: db.Phone, as: 'phoneNumbers' }
            ]
          })
            .then((fetchedUser) => {
              const phones = fetchedUser.get('phoneNumbers');
              const addresses = fetchedUser.get('addresses');

              fetchedUser.get('id').should.be.a('Number');
              addresses.should.be.a('array');
              phones.should.be.a('array');

              addresses.length.should.equal(1);
              phones.length.should.equal(1);

              db.User.destroy({ where: { type: 'client', email: user.email } })
                .then(() => done());
            }).catch((errors) => {
              db.User.destroy({ where: { type: 'client', email: user.email } })
                .then(() => done(errors));
            });
        });
  });
});


describe('Dentist user signup', () => {
  it('Return required fields and valid formats', (done) => {
    agent
      .post(`${API_BASE}/accounts/dentist-signup`)
      .expect('Content-Type', /json/)
      .expect(HTTPStatus.BAD_REQUEST)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        // Should be an array of 15 elements
        Object.keys(res.body.errors).should.have.length(10);
        return done();
      });
  });

  it('Successful signup', (done) => {
    factory.create('dentistSpecialty', (generateError, specialty) => {
      const user = factory.buildSync('user').toJSON();
      user.phone = '732-757-2923';
      user.address = 'This is the address';
      user.tos = true;
      user.confirmPassword = user.password = 'thisPassword43';
      user.confirmEmail = user.email;
      user.specialtyId = specialty.get('id');

      agent
        .post(`${API_BASE}/accounts/dentist-signup`)
        .send(user)
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.CREATED)
        .end((err) => {
          if (err) {
            return done(err);
          }

          return db.User.findOne({
            where: { type: 'dentist', email: user.email },
            include: [
              { model: db.Address, as: 'addresses' },
              { model: db.Phone, as: 'phoneNumbers' },
            ]
          })
          .then((fetchedUser) => {
            const phones = fetchedUser.get('phoneNumbers');
            const addresses = fetchedUser.get('addresses');

            fetchedUser.get('id').should.be.a('Number');
            addresses.should.be.a('array');
            phones.should.be.a('array');

            addresses.length.should.equal(1);
            phones.length.should.equal(1);

            Promise.all([
              db.User.destroy({ where: { type: 'dentist', email: user.email } }),
              db.DentistSpecialty.destroy({ where: { id: specialty.get('id') } })
            ]).then(() => done());
          }).catch((errors) => {
            Promise.all([
              db.User.destroy({ where: { type: 'dentist', email: user.email } }),
              db.DentistSpecialty.destroy({ where: { id: specialty.get('id') } })
            ]).then(() => done(errors));
          });
        });
    });
  });
});


describe('Test activations', () => {
  let user;

  before((done) => {
    user = factory.buildSync('user').toJSON();
    user.phone = '732-757-2923';
    user.address = 'This is the address';
    user.tos = true;
    user.confirmPassword = user.password = 'thisPassword43';
    user.confirmEmail = user.email;
    user.birthDate = new Date();

    agent
      .post(`${API_BASE}/accounts/signup`)
        .send(user)
        .end((err) => {
          if (err) {
            return done(err);
          }
          return done();
        });
  });

  after((done) => {
    db.User.destroy({ where: { type: 'client', email: user.email } })
      .then(() => done());
  });

  it('Activation not found', (done) => {
    agent
      .get(`${API_BASE}/accounts/activate/notfound`)
        .expect(HTTPStatus.NOT_FOUND)
        .end((err) => {
          if (err) {
            return done(err);
          }

          return done();
        });
  });

  it('Activate account', (done) => {
    db.User.find({ where: { type: 'client', email: user.email } })
      .then((fetched) => {
        agent
          .get(`${API_BASE}/accounts/activate/${fetched.get('activationKey')}`)
          .expect(HTTPStatus.OK)
          .end((err) => {
            if (err) {
              return done(err);
            }

            return db.User.find({ where: { type: 'client', email: user.email } })
              .then((tested) => {
                tested.get('verified').should.be.a('boolean');
                tested.get('verified').should.equal(true);
                done();
              });
          });
      });
  });
});


describe('Login test feature', () => {
  let user;

  before((done) => {
    user = factory.buildSync('user').toJSON();
    user.phone = '732-757-2923';
    user.address = 'This is the address';
    user.tos = true;
    user.confirmPassword = user.password = 'thisPassword43';
    user.confirmEmail = user.email;
    user.birthDate = new Date();

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
                  return done();
                });
            });
        });
  });

  after((done) => {
    db.User.destroy({ where: { type: 'client', email: user.email } })
      .then(() => done());
  });

  it('Missing credentials', (done) => {
    agent
      .post(`${API_BASE}/accounts/login`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.BAD_REQUEST)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          res.body.meta.message.should.equal('Missing credentials');
          return done();
        });
  });

  it('Logged in successfuly', (done) => {
    agent
      .post(`${API_BASE}/accounts/login`)
      .send({
        email: user.email,
        password: user.password,
      })
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.CREATED)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          Object.keys(res.body).should.deep.equal(['type', 'token']);

          return done();
        });
  });
});
