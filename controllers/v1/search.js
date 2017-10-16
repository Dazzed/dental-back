import { Router } from 'express';
import _ from 'lodash';
import sequelize from 'sequelize';
import db from '../../models';
import googleMapsClient from '../../services/google_map_api';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'updatedAt'];

async function search(req, res) {
  try {
    const { filters } = req.body;
    const { specialtiesRequired, countRequired } = req.body;
    const {
      searchQuery,
      distance,
      sort,
      specialties,
      coordinates,
    } = filters;
    let sequelizeDistance;
    let dentists = [];
    let whereClause;

    if (searchQuery && searchQuery !== '') {
      let point = await googleMapsClient.geocode({ address: searchQuery }).asPromise();
      if (point.json.results.length > 0) {
        point = point.json.results[0].geometry.location;
        const {
          lat,
          lng
        } = point;
        const location = sequelize.literal(`ST_GeomFromText('POINT(${lat} ${lng})')`);
        sequelizeDistance = sequelize.fn('ST_Distance_Sphere', sequelize.col('location'), location);
        whereClause = sequelize.where(sequelizeDistance, { $lte: Number(distance || 25) * 1000 });
      } else {
        return res.status(400).send({ errors: 'Please Enter a valid search query' });
      }
    } else if (!searchQuery && !distance) {
      whereClause = {};
    } else {
      // Exception
      if (!coordinates) {
        return res.status(200).send({ dentists });
      }
      const {
        lat,
        lng
      } = coordinates;
      if (!lat || !lng) {
        return res.status(200).send({ dentists });
      }
      // End Exception
      const location = sequelize.literal(`ST_GeomFromText('POINT(${lat} ${lng})')`);
      sequelizeDistance = sequelize.fn('ST_Distance_Sphere', sequelize.col('location'), location);
      whereClause = sequelize.where(sequelizeDistance, { $lte: Number(distance) * 1000 });
    }
    dentists = await db.DentistInfo.findAll({
      order: sequelizeDistance,
      where: whereClause,
      include: [{
        model: db.User,
        as: 'user',
        attributes: {
          exclude: userFieldsExcluded,
        },
        include: [{
          model: db.User.sequelize.models.DentistSpecialty,
          as: 'dentistSpecialty',
        }, {
          model: db.Review,
          as: 'dentistReviews'
        }],
      }, {
        model: db.Membership,
        as: 'memberships'
      }]
    }).map(d => d.toJSON());
    // Specialties filter
    if (specialties.length > 0) {
      dentists = dentists.filter(d => specialties.includes(d.user.dentistSpecialtyId));
    }
    // construct starting price for every dentist..
    dentists = dentists
      .filter(d => d.user.verified)
      .map(d => {
        if (d.memberships.length) {
          const planStartingCost = d.memberships.reduce((acc, m) => {
            if (parseFloat(m.price) < parseFloat(acc)) {
              acc = parseFloat(m.price);
            }
            return acc;
          }, parseFloat(d.memberships[0].price));
          delete d.memberships;
          return {
            ...d,
            planStartingCost
          };
        } else {
          delete d.memberships;
          return {
            ...d,
            planStartingCost: 0
          };
        }
      });
    if (sort == 'price') {
      dentists = dentists.sort((d1, d2) => {
        if (d1.planStartingCost > d2.planStartingCost) {
          return 1;
        }
        return -1;
      });
    }
    let specialtiesList = null;
    let totalDentistCount = 0;
    if (specialtiesRequired) {
      specialtiesList = await db.DentistSpecialty.findAll().map(s => s.toJSON());
    }

    if (countRequired) {
      totalDentistCount = await db.User.count({
        where: {
          type: 'dentist',
          verified: true
        }
      });
    }
    return res.status(200).send({ dentists, specialtiesList, totalDentistCount });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

const router = new Router({ mergeParams: true });

router.route('/')
  .post(search);

export default router;
