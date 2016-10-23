module.exports = {
  development: {
    username: process.env.POSTGRESQL_USERNAME || 'dental',
    password: process.env.POSTGRESQL_PASSWORD || 'dental',
    database: process.env.POSTGRESQL_DATABASE || 'dental',
    host: process.env.POSTGRESQL_HOST || 'localhost',
    port: process.env.POSTGRESQL_PORT || 5432,
    dialect: 'postgres'
  },
  test: {
    username: process.env.POSTGRESQL_USERNAME,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DATABASE || 'dental_test',
    host: process.env.POSTGRESQL_HOST,
    port: process.env.POSTGRESQL_PORT,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.POSTGRESQL_USERNAME,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DATABASE,
    host: process.env.POSTGRESQL_HOST,
    port: process.env.POSTGRESQL_PORT,
    dialect: 'postgres'
  }
};
