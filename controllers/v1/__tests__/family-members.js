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
user.birthDate = new Date();


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


describe('Family Members', () => {
  let createdMember;

  it('Get family members', (done) => {
    agent
      .get(`${API_BASE}/users/me/family-members`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.data.length.should.equal(0);
        return done();
      });
  });

  it('Add familyMembers fails', (done) => {
    agent
      .post(`${API_BASE}/users/me/family-members`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send({})
      .expect(HTTPStatus.BAD_REQUEST)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.errors).length.should.equal(6);
        return done();
      });
  });

  it('Add familyMembers success', (done) => {
    const newMember = factory.buildSync('familyMember', {
      firstName: 'Created member',
      phone: 'new phone number'
    });

    agent
      .post(`${API_BASE}/users/me/family-members`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(newMember)
      .expect(HTTPStatus.CREATED)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.data).length.should.equal(11);
        res.body.data.firstName.should.equal(newMember.firstName);
        res.body.data.phone.should.equal(newMember.phone);
        createdMember = res.body.data;

        return db.FamilyMember
          .count({ where: { userId: res.body.data.userId } })
          .then((members) => {
            members.should.equal(1);
            done();
          });
      });
  });

  it('Get familyMember', (done) => {
    agent
      .get(`${API_BASE}/users/me/family-members/${createdMember.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.data).length.should.equal(11);
        res.body.data.firstName.should.equal(createdMember.firstName);
        res.body.data.phone.should.equal(createdMember.phone);
        return done();
      });
  });

  it('Edit familyMember', (done) => {
    createdMember.firstName = 'Changed name';
    createdMember.phone = 'new phone';

    agent
      .put(`${API_BASE}/users/me/family-members/${createdMember.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(createdMember)
      .expect(HTTPStatus.OK)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Object.keys(res.body.data).length.should.equal(11);
        res.body.data.firstName.should.equal(createdMember.firstName);
        res.body.data.phone.should.equal(createdMember.phone);

        return db.FamilyMember
          .count({ where: { userId: res.body.data.userId } })
          .then((members) => {
            members.should.equal(1);
            done();
          });
      });
  });

  it('Remove familyMember', (done) => {
    agent
      .delete(`${API_BASE}/users/me/family-members/${createdMember.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((err) => {
        if (err) {
          return done(err);
        }

        return db.FamilyMember
          .count({ where: { userId: createdMember.userId } })
          .then((members) => {
            members.should.equal(0);
            done();
          });
      });
  });
});
