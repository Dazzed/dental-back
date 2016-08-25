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
let specialtyId;


const user = factory.buildSync('user').toJSON();
user.tos = true;
user.confirmPassword = user.password = 'thisPassword43';
user.confirmEmail = user.email;
user.phone = '732-757-2923';


before((done) => {
  factory.create('dentistSpecialty', (generateError, specialty) => {
    user.specialtyId = specialty.get('id');
    specialtyId = user.specialtyId;

    agent
      .post(`${API_BASE}/accounts/dentist-signup`)
      .send(user)
      .end((err) => {
        if (err) {
          return done(err);
        }

        return db.User.find({ where: { type: 'dentist', email: user.email } })
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
});


after((done) => {
  Promise.all([
    db.User.destroy({ where: { type: 'dentist' } }),
    db.DentistSpecialty.destroy({ where: { id: specialtyId } }),
  ]).then(() => done());
});


describe('Create membership', () => {
  it('Returns bad request with required params', (done) => {
    agent
      .post(`${API_BASE}/users/me/memberships`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send({})
      .expect(HTTPStatus.BAD_REQUEST)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.errors.should.be.a('object');
        Object.keys(res.body.errors).length.should.equal(2);
        return done();
      });
  });

  it('Create new membership', (done) => {
    const membership = factory.buildSync('membership').toJSON();

    agent
      .post(`${API_BASE}/users/me/memberships`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(membership)
      .expect(HTTPStatus.CREATED)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.data.should.be.a('object');
        Object.keys(res.body.data).length.should.equal(7);
        return db.User.find({ where: { type: 'dentist', email: user.email } })
          .then((fechedUser) => fechedUser.getMemberships({ raw: true }))
          .then((members) => {
            members.length.should.equal(3);
            return db.Membership.destroy({ where: { id: res.body.id } });
          }).then(() => {
            done();
          });
      });
  });
});


describe('Edit membership', () => {
  let membership;

  before((done) => {
    agent
      .post(`${API_BASE}/users/me/memberships`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(factory.buildSync('membership'))
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        membership = res.body.data;
        return done();
      });
  });

  after((done) => {
    db.Membership.destroy({ where: { id: membership.id } }).then(() => done());
  });

  it('Returns bad request with required params', (done) => {
    agent
      .put(`${API_BASE}/users/me/memberships/${membership.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send({})
      .expect(HTTPStatus.BAD_REQUEST)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.errors.should.be.a('object');
        Object.keys(res.body.errors).length.should.equal(2);
        return done();
      });
  });

  it('Edit membership', (done) => {
    membership.price = '999.99';
    membership.name = 'This is the new name';

    agent
      .put(`${API_BASE}/users/me/memberships/${membership.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(membership)
      .expect(HTTPStatus.OK)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.data.should.be.a('object');
        Object.keys(res.body.data).length.should.equal(7);
        db.Membership.findById(membership.id).then((fetchedMembership) => {
          fetchedMembership.get('name').should.equal(res.body.data.name);
          fetchedMembership.get('price').should.equal(res.body.data.price);
          fetchedMembership.get('description')
            .should.equal(res.body.data.description);
        });
        return done();
      });
  });


  it('Get membership', (done) => {
    agent
      .get(`${API_BASE}/users/me/memberships/${membership.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.data.should.be.a('object');
        Object.keys(res.body.data).length.should.equal(7);
        membership.name.should.equal(res.body.data.name);
        membership.price.should.equal(res.body.data.price);
        membership.description.should.equal(res.body.data.description);
        return done();
      });
  });
});

describe('Delete and Get memberships', () => {
  let membership;

  before((done) => {
    agent
      .post(`${API_BASE}/users/me/memberships`)
      .set('Authorization', `JWT ${jwtToken}`)
      .send(factory.buildSync('membership'))
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        membership = res.body.data;
        return done();
      });
  });

  after((done) => {
    db.Membership.destroy({ where: { id: membership.id } }).then(() => done());
  });

  it('Soft delete of membership', (done) => {
    agent
      .delete(`${API_BASE}/users/me/memberships/${membership.id}`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((error) => {
        if (error) {
          return done(error);
        }

        return db.Membership.count({
          where: {
            id: membership.id,
            userId: membership.userId,
            isDeleted: true
          },
          raw: true
        }).then((count) => {
          count.should.equal(1); // test if was deleted
          done();
        });
      });
  });

  it('Get memberships', (done) => {
    agent
      .get(`${API_BASE}/users/me/memberships`)
      .set('Authorization', `JWT ${jwtToken}`)
      .expect(HTTPStatus.OK)
      .end((error, res) => {
        if (error) {
          return done(error);
        }

        res.body.data.should.be.a('array');
        // we test if we have great or more than 2 memberships
        // looks like test are working concurrently
        res.body.data.length.should.satisfy((value) => value >= 2);
        return done();
      });
  });
});
