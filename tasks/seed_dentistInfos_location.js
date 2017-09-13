require('babel-register');
const db = require('../models');
const googleMapsClient = require('../services/google_map_api');

async function seed_dentistInfos_location() {
  try {
    const dentistInfos = await db.DentistInfo.findAll({
    });

    for (let dentistInfo of dentistInfos) {
      const {
        address,
        city,
        state,
        zipCode
      } = dentistInfo;
      const addressQuery = `${address}, ${city}, ${state}, ${zipCode}`;
      let point = await googleMapsClient.geocode({ address: addressQuery }).asPromise();
      point = point.json.results[0].geometry.location;
      dentistInfo.location = {
        type: 'Point',
        coordinates: [point.lat, point.lng]
      };
      await dentistInfo.save();
    }
  } catch (e) {
    throw e;
  }
}

seed_dentistInfos_location().then(() => {
  console.log('***seed_dentistInfos_location Executed Successfully***');
  return;
}, e => console.log(e));
