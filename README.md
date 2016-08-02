Sequelize
=========

To allow better development workflow with database we have to take in mind
these:

* Run migrations `sequelize db:migrate`
* To create a new migration  run `sequelize migration:create migration-name`
* To go back one migration `sequelize db:migrate:undo`
* Each new model has to have its initial migration.
* Environment Variables, with empty values will use default ones.

```bash
POSTGRESQL_USERNAME=postgres
POSTGRESQL_PASSWORD=password
POSTGRESQL_DATABASE=database-name
POSTGRESQL_HOST=192.168.111.17
POSTGRESQL_PORT=5432
```

