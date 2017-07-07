DentalHQ Backend
================================================================================


Setup
================================================================================

Local Server
------------------------------------------------------------
 1. `npm install`

Local Database
------------------------------------------------------------
 1. Install and open the [Postgres App](http://postgresapp.com/).

 2. Create a `.env` file in the project's root with the following fields.
    Be sure to fill out the `user`, `pass`, and `secret` values. Don't specify a
    `POSTGRESQL_DATABASE` field- the dev and test scripts will supply their
    own defaults (setup below).  See the `config/config.js` file for details.

    ```
    POSTGRESQL_USERNAME=user
    POSTGRESQL_PASSWORD='pass'
    POSTGRESQL_HOST='localhost'
    POSTGRESQL_PORT=5432

    JWT_SECRET='secret'
    ```

 3. Create the role, dev, and test databases in `psql`. Use the `user` and
    `pass` values you setup in your `.env` file.

    ```
    CREATE USER "user" WITH PASSWORD 'pass';
    CREATE DATABASE dental OWNER "user";
    CREATE DATABASE dental_test OWNER "user";
    ```

 4. Install the Sequelize command line tools globally:
    `npm install -g sequelize-cli`

 5. Setup the initial database:

    ```
    npm run migrate
    npm run seed
    ```

Heroku Server & Database
------------------------------------------------------------
**NOTE:** Only for first time setup.  See "Deployment" below for regular use.

Helpful URLs:

  * [Heroku Postgresql](https://devcenter.heroku.com/articles/heroku-postgresql)
  * [Use Sequelize w/ Heroku](http://docs.sequelizejs.com/en/1.7.0/articles/heroku/)

Setup Steps:

 1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli).

 2. Configure heroku.

    ```
    # Do an initial deploy.
    heroku git:remote -a dentalhq-dev-server
    git push heroku master

    # Generate a secret.
    openssl rand -base64 128

    # Setup the Heroku add-on and get info needed for config variables.
    heroku addons:create heroku-postgresql
    heroku pg:credentials DATABASE
    ```

 3. Setup the environment variables in Heroku's Config Variables section.

    ```
    POSTGRESQL_USERNAME :: db-user-from-above
    POSTGRESQL_PASSWORD :: db-pass-from-above
    POSTGRESQL_DATABASE :: db-name-from-above
    POSTGRESQL_HOST     :: db-host-from-above
    POSTGRESQL_PORT     :: db-port-from-above

    JWT_SECRET          :: secret-from-above
    ```

 4. Setup the database on Heroku using Sequelize.

    ```
    heroku run bash
    sequelize -m
    sequelize db:migrate
    sequelize db:seed:all
    ```

 5. You're done- grab a beer! :D


Development
================================================================================

Using Sequelize
------------------------------------------------------------
To allow better development workflow with database we have to take in mind
these:

  * Run migrations `sequelize db:migrate`
  * To create a new migration  run `sequelize migration:create migration-name`
  * To go back one migration `sequelize db:migrate:undo`
  * Each new model has to have its initial migration.
  * Environment Variables, with empty values will use default ones. These should
    be set in the `.env` file in the project's root.  See this readme's
    "Setup - Database" section and the `config/config.js` file for details.

    ```
    POSTGRESQL_USERNAME=postgres
    POSTGRESQL_PASSWORD=password
    POSTGRESQL_DATABASE=database-name
    POSTGRESQL_HOST=192.168.111.17
    POSTGRESQL_PORT=5432
    ```

Running Locally
------------------------------------------------------------
```
npm run-script dev
```


Deployment
================================================================================
```
git push heroku master
```
