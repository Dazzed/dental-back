module.exports = {
  development: {
    username: process.env.POSTGRESQL_USERNAME || 'postgres',
    password: process.env.POSTGRESQL_PASSWORD || 'abcd1234',
    database: process.env.POSTGRESQL_DATABASE || 'dental',
    host: process.env.POSTGRESQL_HOST || 'localhost',
    port: process.env.POSTGRESQL_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    username: process.env.STAGING_POSTGRESQL_USERNAME,
    password: process.env.STAGING_POSTGRESQL_PASSWORD,
    database: process.env.STAGING_POSTGRESQL_DATABASE || 'dental_test',
    host: process.env.STAGING_POSTGRESQL_HOST,
    port: process.env.STAGING_POSTGRESQL_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: true
    }
  },
  production: {
    username: process.env.PRODUCTION_POSTGRESQL_USERNAME,
    password: process.env.PRODUCTION_POSTGRESQL_PASSWORD,
    database: process.env.PRODUCTION_POSTGRESQL_DATABASE,
    host: process.env.PRODUCTION_POSTGRESQL_HOST,
    port: process.env.PRODUCTION_POSTGRESQL_PORT,
    url: process.env.PRODUCTION_DATABASE_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: true
    }
  }
};
