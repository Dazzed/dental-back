module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('priceCodes', [{
    code: '0120',
    description: 'Periodic Exam'
  }, {
    code: '0140',
    description: 'Emergency Exam'
  }, {
    code: '0150',
    description: 'New Patient Exam'
  }, {
    code: '0220',
    description: 'Periapical (root) X-Ray'
  }, {
    code: '0272',
    description: '2 Bitewing (tooth) X-Rays'
  }, {
    code: '0274',
    description: '4 Bitewing (tooth) X-Rays'
  }, {
    code: '0330',
    description: 'Panoramic (full mouth) X-Ray'
  }, {
    code: '1110',
    description: 'Basic Cleaning (adult)'
  }, {
    code: '1120',
    description: 'Basic Cleaning (child)'
  }, {
    code: '1206',
    description: 'Fluoride Treatment'
  }, {
    code: '2391',
    description: 'One surface white filling'
  }, {
    code: '2392',
    description: 'Two surface white filling'
  }, {
    code: '2750',
    description: 'Porcelain crown'
  }, {
    code: '3330',
    description: 'Molar Root Canal'
  }, {
    code: '4341',
    description: 'Deep Cleaning (per quadrant)'
  }, {
    code: '4910',
    description: 'Periodontal Cleaning'
  }, {
    code: '7140',
    description: 'Tooth Extraction'
  }], {}),
  down: (queryInterface) => queryInterface.bulkDelete('priceCodes', null, {})
};
