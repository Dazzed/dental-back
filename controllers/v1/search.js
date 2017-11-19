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
        whereClause = sequelize.where(sequelizeDistance, { $lte: Number(distance || 25) * 1609.34 });
      } else {
        return res.status(400).send({ errors: 'Please Enter a valid search query' });
      }
    } else {
      whereClause = {};
    }
    dentists = await db.DentistInfo.findAll({
      order: sequelizeDistance,
      where: {
        $and: [whereClause, { marketplaceOptIn: true }]
      },
      include: [{
        model: db.User,
        as: 'user',
        attributes: {
          exclude: userFieldsExcluded,
        },
        where: { verified: true },
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
    const totalDentistCount = dentists.length;
    // Specialties filter
    if (specialties) {
      dentists = dentists.filter(d => specialties == (d.user.dentistSpecialtyId));
    }
    // construct starting price for every dentist..
    dentists = dentists
      .filter(d => d.user.verified)
      .map(d => {
        if (d.memberships.length) {
          // try to find the lowest active adult monthly membership cost
          let planStartingCost = d.memberships
            .filter(m => m.active && m.subscription_age_group === 'adult' && m.type === 'month')
            .reduce((acc, m) => {
              if (parseFloat(m.price) < parseFloat(acc)) {
                acc = parseFloat(m.price);
              }
              return acc;
            }, Number.MAX_SAFE_INTEGER);

          // if the dentist only caters towards children, or only has yearly plans,
          // get the smallest cost active membership instead
          if (planStartingCost === Number.MAX_SAFE_INTEGER) {
            planStartingCost = d.memberships
              .filter(m => m.active)
              .reduce((acc, m) => {
                if (parseFloat(m.price) < parseFloat(acc)) {
                  acc = parseFloat(m.price);
                }
                return acc;
              }, Number.MAX_SAFE_INTEGER);
          }

          // if there are no memberships, set the value as `null` and let the
          // frontend handle it
          if (planStartingCost === Number.MAX_SAFE_INTEGER) {
            planStartingCost = null;
          }

          delete d.memberships;
          return {
            ...d,
            planStartingCost
          };
        } else {
          delete d.memberships;
          return {
            ...d,
            planStartingCost: null
          };
        }
      });
    // construct rating for every dentist...
    dentists = dentists.map((d) => {
        const ratingScore = d.user.dentistReviews.reduce((acc, r) => acc + r.rating, 0);
        const totalReviews = d.user.dentistReviews.length;
        const averageRating = ratingScore / totalReviews;
        const rating = isNaN(averageRating) ? 0 : averageRating;
        return {
          ...d,
          rating
        };
      });
    if (sort === 'price') {
      dentists = dentists.sort((d1, d2) => {
        if (d1.planStartingCost > d2.planStartingCost) {
          return 1;
        }
        return -1;
      });
    } else if (sort === 'score') {
      dentists = dentists.sort((d1, d2) => {
          if (d1.rating < d2.rating) {
            return 1;
          }
          return -1;
        });
    }

    let specialtiesList = null;
    if (specialtiesRequired) {
      specialtiesList = await db.DentistSpecialty.findAll().map(s => s.toJSON());
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
