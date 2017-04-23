Below is a list of recommendations made by @Stephn-R for how to improve the state and quality of this project. Many of these items were listed during the initial evaluation performed by @Stephn-R on his initial entry to this project.

---

### Recommendations*
1. Add CircleCI for auto deployment and code health tracking 
2. Utilize the [CORS](https://www.npmjs.com/package/cors) module for managing CORS headers via ENV vars
3. Consider utilizing Typescript (does not require full code rewrite with `allowJS` flag)
4. Introduce JSDoc comments all around in order to improve code documentation health
5. Consider including `Swagger` for producing complete and custom generated API docs
6. Consider using ES6 classes to build controller endpoints and map using `.bind()` via a router management file
7. Consider moving tests to a root level folder and introduce larger testing frameworks/resources
8. Add [helmet](https://www.npmjs.com/package/helmet) module to add security middleware 

### Enhancements to existing project**
1. [index.js] - remove call to `dotenv` at beginning and enforce loading of env vars in check for `.env` file
2. [index.js] - refactor code to use ES6 imports
3. [ALL] - export middleware operations to a single middleware file
4. [index.js] - export AWS S3 endpoints and connections to a unique file for management
5. [index.js] - export mailing endpoints and operations to a unique file for management
6. [ALL HTML files] - consider leveraging Nunjucks API to use template extension to reduce code duplication
7. [ALL HTML files] - avoid the use of `table` elements since these are not good for building responsive interfaces
8. [orm-methods/*] - many of these methods are based on the existence of properties but rather should be navigational properties in the ORM models instead
9. [ALL] - extend the list of possible HTTP return headers in order to properly match HTTP headers to controller actions
10. [ALL] - collect all HTTP route filters in a single folder and included through a module barrel
11. [ALL] - use Node router management to better control API routing
12. [ALL] - consider removing all commented code/unnecessary code in order to recollect unused whitespace

### Security Analysis Report***
1. (CRITICAL) `passport-local-sequelize@0.6.0` is vulnerable to SQL injection via GeoJSON. (Fixed by updating sequelize >= 3.23.6)
2. (HIGH) `sequelize-cli@2.7.0` is vulnerable to Regular Expression Denial of Service. (Fixed by updating minimatch >= 3.0.2) 
3. (MEDIUM) `sequelize@3.1.1` is vulnerable to Improper Escaping of Bound Arrays. (Fixed by updating sequelize >= 3.20.0)

---

<sub>* these are suggestions for new content to further improve the health/performance of this codebase</sub>

<sub>** these are suggestions for refactoring or replacing existing code/tools</sub>

<sub>*** these are vulnerabilities that were detected based on the current modules used (as of Apr. 23rd)</sub>

<sub>It should be understood that these are merely ***suggestions*** and should be seen as such.</sub>
