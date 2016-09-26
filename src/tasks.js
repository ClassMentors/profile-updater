/**
 * profile-updater/src/tasks.js - define the firebase-queue hanlder for profile update.
 */
'use strict';

/**
 * Create firebase-queue handler to process.
 *
 * @param  {object} services List of third party service manager.
 * @return {{profile: function}}
 */
exports.handlersFactory = function(services) {

  return {

    /**
     * Process a profile update task.
     *
     * @param  {object}   data     Task Data
     * @param  {function} progress Report progress
     * @param  {function} resolve  Report task completion
     * @param  {function} reject   Report task failure
     */
    profile(data, progress, resolve, reject) {
      const serviceId = data.service;
      const publicId = data.id;
      const service = services[serviceId];

      if (!service) {
        reject(new Error(`No service handler for service id "${serviceId}"`));
        return;
      }

      service.updateAchievements(publicId).then(resolve, reject);

    }

  };
};
