/**
 * profile-updater/src/services.js - define the third party services handler.
 */
'use strict';

const camelCase = require('lodash.camelcase');
const Xray = require('x-ray');
const kebabCase = require('lodash.kebabcase');

/**
 * Create services manager.
 *
 * @param  {firebase.app.App}                         firebaseApp        Classmentors firebase App.
 * @param  {firebase.app.App}                         pivotalFirebaseApp Pivotal Expert firebase App.
 * @param  {{get: function(): Promise<object,Error>}} http               HTTP client
 * @return {{codeCombat: Service, freeCodeCamp: Service, pivotalExpert: Service}}
 */
exports.factory = function servicesFactory(firebaseApp, pivotalFirebaseApp, http) {

  /**
   * Manage a service.
   *
   * Should be able to fetch user achievements with the third party service and
   * update the user profile.
   *
   */
  class Service {

    /**
     * Service constructor.
     *
     * Set the service name and id
     *
     * @param  {string} name    Service name.
     * @param  {object} options Service options.
     */
    constructor(name, options) {
      options = options || {};

      this.name = name;
      this.serviceId = options.serviceId || camelCase(name);
    }

    /**
     * Update the the user achievement.
     *
     * @param  {string} publicId User publicId
     * @return {Promise<void,Error>}
     */
    updateAchievements(publicId) {
      const ref = this.dataRef(publicId);
      const lastUpdate = {'.sv': 'timestamp'};

      return ref.child('details').once('value').then(snapshot => {
        const details = snapshot.val();

        if (!details || !details.id) {
          return Promise.reject(new Error(`The user is not registered with the ${this.name} service.`));
        }

        return details.id;
      }).then(
        userId => this.fetch(userId)
      ).then(
        data => ref.update(Object.assign({}, data, {lastUpdate}))
      );
    }

    /**
     * Return a firebase reference to the user data for this service.
     *
     * @param  {[type]} publicId [description]
     * @return {[type]}          [description]
     */
    dataRef(publicId) {
      const db = firebaseApp.database();

      return db.ref(`classMentors/userProfiles/${publicId}/services/${this.serviceId}`);
    }

    /**
     * Fetch the user's third party achievements.
     *
     * @param  {string} userId The user's third party service user id.
     * @return {Promise<object,Error>}
     */
    fetch(userId) {
      const url = this.profileUrl(userId);

      return http.get(url).then(
        resp => this.transform(resp)
      );
    }

    /**
     * Should return the URL to the user profile for this service.
     *
     * @param  {string} userId User's id for this service
     */
    profileUrl() {
      throw new Error('not implemented');
    }

    /**
     * Should transform the user's third party profile data to achievements.
     *
     * @param  {{data: object}} resp HTTP response.
     * @return {Promise<object,Error>}
     */
    transform() {
      return Promise.reject(new Error('not implemented'));
    }

  }

  /**
   * Handle Code Combat profiles update.
   *
   * @todo normalize level schema?
   */
  class CodeCombat extends Service {

    constructor() {
      super('Code Combat');
    }

    profileUrl(userId) {
      return `https://codecombat.com/db/user/${userId}/level.sessions?project=state.complete,levelID,levelName`;
    }

    transform(resp) {
      if (!resp.data || !resp.data.length) {
        return {totalAchievements: 0, achievements: {}};
      }

      const achievements = {};

      resp.data.forEach(item => {
        if (!item || !item.state || !item.state.complete || !item.levelID) {
          return;
        }

        achievements[item.levelID] = item;
      });

      return {achievements, totalAchievements: Object.keys(achievements).length};
    }

  }

  /**
   * Handle Free Code Camp profile update.
   *
   * Scrap the HTML profile page for the list of achievements.
   *
   * @todo normalize achievement schema?
   */
  class FreeCodeCamp extends Service {

    constructor() {
      super('Free Code Camp');
    }

    profileUrl(userId) {
      return `https://www.freecodecamp.com/${userId}`;
    }

    transform(resp) {
      return Promise.all([
        this.getTotal(resp),
        this.getAchievements(resp)
      ]).then(results => {
        const totalAchievements = results[0];
        const achievements = results[1];

        return {achievements, totalAchievements};
      });
    }

    getTotal(resp) {
      const start = resp.data.indexOf('>[ ');
      const stop = resp.data.indexOf(' ]<');
      const total = parseInt(
        resp.data.substring(start + 3, stop),
        10
      );

      return isNaN(total) ? -1 : total;
    }

    getAchievements(resp) {
      const x = new Xray();
      const scope = 'table.table-striped tr';

      return new Promise((resolve, reject) => {
        x(resp.data, scope, [{
          name: 'td:nth-child(1)',
          complete: 'td:nth-child(2)'
        }])((err, result) => {
          if (err) {
            reject(err);
            return;
          }

          const achievements = {};

          result.forEach(el => {
            const id = kebabCase(el.name);

            if (id) {
              achievements[id] = el;
            }
          });

          resolve(achievements);
        });
      });
    }

  }

  /**
   * Handle Pivotal Expert profile update.
   *
   * Fetch pivotal expert firebase app directly.
   *
   * @todo set up pivotal expert firebase App
   * @todo find path to achievements.
   * @todo normalize achievements schema?
   */
  class PivotalExpert extends Service {

    constructor() {
      super('Pivotal Expert');
    }

    fetch(userId) {
      if (!pivotalFirebaseApp) {
        return {totalAchievements: 0};
      }

      const db = pivotalFirebaseApp.database();
      const ref = db.ref(`some/path/${userId}/achievements`);

      return ref.once('value').then(achievements => {
        return {
          achievements,
          totalAchievements: Object.keys(achievements).length
        };
      });
    }

  }

  return {
    codeCombat: new CodeCombat(),
    freeCodeCamp: new FreeCodeCamp(),
    pivotalExpert: new PivotalExpert()
  };
};
