module.exports = {
  up: (queryInterface) => queryInterface.bulkInsert('priceCodes', [{
    id: 1,
    code: '0120',
    description: 'Periodic Exam'
  }, {
    id: 2,
    code: '0140',
    description: 'Emergency Exam'
  }, {
    id: 3,
    code: '0150',
    description: 'New Patient Exam'
  }, {
    id: 4,
    code: '0220',
    description: 'Periapical (root) X-Ray'
  }, {
    id: 5,
    code: '0272',
    description: '2 Bitewing (tooth) X-Rays'
  }, {
    id: 6,
    code: '0274',
    description: '4 Bitewing (tooth) X-Rays'
  }, {
    id: 7,
    code: '0330',
    description: 'Panoramic (full mouth) X-Ray'
  }, {
    id: 8,
    code: '1110',
    description: 'Basic Cleaning (adult)'
  }, {
    id: 9,
    code: '1120',
    description: 'Basic Cleaning (child)'
  }, {
    id: 10,
    code: '1206',
    description: 'Fluoride Treatment'
  }, {
    id: 11,
    code: '2391',
    description: 'One surface white filling'
  }, {
    id: 12,
    code: '2392',
    description: 'Two surface white filling'
  }, {
    id: 13,
    code: '2750',
    description: 'Porcelain crown'
  }, {
    id: 14,
    code: '3330',
    description: 'Molar Root Canal'
  }, {
    id: 15,
    code: '4341',
    description: 'Deep Cleaning (per quadrant)'
  }, {
    id: 16,
    code: '4910',
    description: 'Periodontal Cleaning'
  }, {
    id: 17,
    code: '7140',
    description: 'Tooth Extraction'
  }], {}),
  down: (queryInterface) => queryInterface.bulkDelete('priceCodes', null, {})
};
