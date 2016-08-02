module.exports = {
  development: {
    username: process.env.POSTGRESQL_USERNAME,
    password: process.env.POSTGRESQL_PASSWORD,
    database: process.env.POSTGRESQL_DATABASE || 'dental',
    host: process.env.POSTGRESQL_HOST,
    port: process.env.POSTGRESQL_PORT,
    dialect: 'postgres'
  },
  test: {
    username: 'root',
    password: null,
    database: 'database_test',
    host: '127.0.0.1',
    dialect: 'mysql'
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
