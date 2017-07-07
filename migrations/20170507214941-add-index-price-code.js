module.exports = {
  up: (queryInterface) => queryInterface.addIndex('priceCodes', ['code'], {
    indexName: 'UNIQUE_PRICE_CODE_IDX',
    indicesType: 'UNIQUE'
  }),
  down: (queryInterface) => queryInterface.removeIndex('priceCodes', 'UNIQUE_PRICE_CODE_IDX')
};
