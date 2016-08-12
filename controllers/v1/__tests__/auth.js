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
        Object.keys(res.body).should.have.length(15);
        return done();
      });
  });

  it('Successful signup without family member', (done) => {
    factory.build('user', (generateError, generatedUser) => {
      const user = generatedUser.toJSON();
      user.phone = '732-757-2923';
      user.address = 'This is the address';
      user.tos = true;
      user.confirmPassword = user.password = 'thisPassword43';
      user.confirmEmail = user.email;
      /* eslint-disable max-len */
      user.avatar = {
        dataUri: 'data:image/jpeg;base64,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',
        filename: 'images.jpeg',
        filetype: 'image/jpeg',
      };
      /* eslint-enable max-len */

      agent
        .post(`${API_BASE}/accounts/signup`)
        .send(user)
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.CREATED)
        .end((err) => {
          if (err) {
            return done(err);
          }

          return Promise.all([
            db.User.count({ where: { type: 'client' } }),
            db.Address.count(),
            db.Phone.count(),
          ]).then(([users, addresses, phones]) => {
            users.should.be.a('Number');
            addresses.should.be.a('Number');
            phones.should.be.a('Number');

            users.should.equal(1);
            addresses.should.equal(1);
            phones.should.equal(1);
            db.User.destroy({ where: { type: 'client' } }).then(() => done());
          }).catch((errors) => {
            db.User.destroy({ where: { type: 'client' } }).then(() => done(errors));
          });
        });
    });
  });

  it('Return family members is not valid', (done) => {
    factory.build('user', (generateError, generatedUser) => {
      const user = generatedUser.toJSON();
      user.phone = '732-757-2923';
      user.address = 'This is the address';
      user.tos = true;
      user.confirmPassword = user.password = 'thisPassword43';
      user.confirmEmail = user.email;
      user.familyMembers = [{}, {}];

      agent
        .post(`${API_BASE}/accounts/signup`)
        .send(user)
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.BAD_REQUEST)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          res.body.familyMembers.should.be.a('object');
          return done();
        });
    });
  });

  it('Register normal user with family members', (done) => {
    factory.build('user', (generateError, generatedUser) => {
      const user = generatedUser.toJSON();
      user.phone = '732-757-2923';
      user.address = 'This is the address';
      user.tos = true;
      user.confirmPassword = user.password = 'thisPassword43';
      user.confirmEmail = user.email;
      user.familyMembers = [
        factory.buildSync('familyMember', { firstName: 'Member1', phone: 'Phone1' }),
        factory.buildSync('familyMember', { firstName: 'Member2', phone: 'Phone2' }),
      ];

      agent
        .post(`${API_BASE}/accounts/signup`)
        .send(user)
        .expect('Content-Type', /json/)
        .expect(HTTPStatus.CREATED)
        .end((err) => {
          if (err) {
            return done(err);
          }
          return Promise.all([
            db.User.count({ where: { type: 'client' } }),
            db.Address.count(),
            db.Phone.count(),
            db.FamilyMember.count(),
          ]).then(([users, addresses, phones, members]) => {
            users.should.be.a('Number');
            addresses.should.be.a('Number');
            phones.should.be.a('Number');
            members.should.be.a('Number');

            users.should.equal(1);
            addresses.should.equal(1);
            phones.should.equal(1);
            members.should.equal(2);

            db.User.destroy({ where: { type: 'client' } }).then(() => done());
          }).catch((errors) => {
            db.User.destroy({ where: { type: 'client' } }).then(() => done(errors));
          });
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
        Object.keys(res.body).should.have.length(10);
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

          return Promise.all([
            db.User.count({ where: { type: 'dentist' } }),
            db.Address.count(),
            db.Phone.count(),
          ]).then(([users, addresses, phones]) => {
            users.should.be.a('Number');
            addresses.should.be.a('Number');
            phones.should.be.a('Number');

            users.should.equal(1);
            addresses.should.equal(1);
            phones.should.equal(1);

            Promise.all([
              db.User.destroy({ where: { type: 'dentist' } }),
              db.DentistSpecialty.destroy({ where: { id: specialty.get('id') } })
            ]).then(() => done());
          }).catch((errors) => {
            Promise.all([
              db.User.destroy({ where: { type: 'dentist' } }),
              db.DentistSpecialty.destroy({ where: { id: specialty.get('id') } })
            ]).then(() => done(errors));
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
    db.User.destroy({ where: { type: 'client' } }).then(() => done());
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

          res.body.message.should.equal('Missing credentials');
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

          Object.keys(res.body).should.deep.equal(['id', 'email', 'type']);
          return done();
        });
  });
});
