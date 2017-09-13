require('babel-register');
const db = require('../models');
const sequelize = require('sequelize');

const location = sequelize.literal(`ST_GeomFromText('POINT(34.100000 -118.500000)')`);
const distance = sequelize.fn('ST_Distance_Sphere', sequelize.col('location'), location);

db.DentistInfo.findAll({
  order: distance,
  where: sequelize.where(distance, { $lte: 25 * 1000 })
}).then(d =>{
  d = d.map(t => t.toJSON());
  console.log(d.map(t => t.id));
  console.log(d.map(t => t.location));
}, e => console.log(e));