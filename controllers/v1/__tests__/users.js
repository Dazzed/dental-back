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


const user = factory.buildSync('user').toJSON();
user.phone = '732-757-2923';
user.address = 'This is the address';
user.tos = true;
user.confirmPassword = user.password = 'thisPassword43';
user.confirmEmail = user.email;

user.familyMembers = [
  factory.buildSync('familyMember', { firstName: 'Member1', phone: 'Phone1' }),
  factory.buildSync('familyMember', { firstName: 'Member2', phone: 'Phone2' }),
];


before((done) => {
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

  it('User Not Found', (done) => {
    agent
      .get(`${API_BASE}/users/0`)
        .set('Authorization', `JWT ${jwtToken}`)
        .expect(HTTPStatus.NOT_FOUND)
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


describe('Family Members', () => {
  let firstMember;
  let toBeDeleted;

  it('Get family members', (done) => {
    agent
      .get(`${API_BASE}/users/me/family-members`)
        .set('Authorization', `JWT ${jwtToken}`)
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.data.length.should.equal(2);
          Object.keys(res.body.data[0]).length.should.equal(11);
          Object.keys(res.body.data[1]).length.should.equal(11);
          firstMember = res.body.data[0];
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
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          Object.keys(res.body.data).length.should.equal(11);
          res.body.data.firstName.should.equal(newMember.firstName);
          res.body.data.phone.should.equal(newMember.phone);
          toBeDeleted = res.body.data;

          return db.FamilyMember
            .count({ where: { userId: res.body.data.userId } })
            .then((members) => {
              members.should.equal(3);
              done();
            });
        });
  });

  it('Get familyMember', (done) => {
    agent
      .get(`${API_BASE}/users/me/family-members/${firstMember.id}`)
        .set('Authorization', `JWT ${jwtToken}`)
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          Object.keys(res.body.data).length.should.equal(11);
          res.body.data.firstName.should.equal(firstMember.firstName);
          res.body.data.phone.should.equal(firstMember.phone);
          return done();
        });
  });

  it('Edit familyMember', (done) => {
    firstMember.firstName = 'Changed name';
    firstMember.phone = 'new phone';

    agent
      .put(`${API_BASE}/users/me/family-members/${firstMember.id}`)
        .set('Authorization', `JWT ${jwtToken}`)
        .send(firstMember)
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          Object.keys(res.body.data).length.should.equal(11);
          res.body.data.firstName.should.equal(firstMember.firstName);
          res.body.data.phone.should.equal(firstMember.phone);

          return db.FamilyMember
            .count({ where: { userId: res.body.data.userId } })
            .then((members) => {
              members.should.equal(3);
              done();
            });
        });
  });

  it('Remove familyMember', (done) => {
    agent
      .delete(`${API_BASE}/users/me/family-members/${toBeDeleted.id}`)
        .set('Authorization', `JWT ${jwtToken}`)
        .expect(HTTPStatus.OK)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          return db.FamilyMember
            .count({ where: { userId: toBeDeleted.userId } })
            .then((members) => {
              members.should.equal(2);
              done();
            });
        });
  });
});
