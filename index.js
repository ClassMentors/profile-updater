/**
 * profile-updater.
 *
 * Define AWS lambda event handler
 *
 */
/* eslint no-process-exit: "off" */
'use strict';

const firebase = require('firebase');
const Queue = require('firebase-queue');
const tasks = require('./src/tasks');
const http = require('./src/http');
const servicesModule = require('./src/services');

const SECRET_KEY = process.env.GOOGLE_CLOUD_OAUTH2_SECRET_KEY || './firebase-key.json';
const CLASSMENTORS_DATABASE_URL = process.env.CLASSMENTORS_DATABASE_URL || 'https://singpath-play.firebaseio.com';
const CLASSMENTORS_PROFILE_WORKER_UID = process.env.CLASSMENTORS_PROFILE_WORKER_UID || 'queue-worker';
const CLASSMENTORS_PROFILE_WORKER_COUNT = parseInt(process.env.CLASSMENTORS_PROFILE_WORKER_COUNT || '3', 10);
const APPS = {};

/**
 * Get a service account firebase App for Classmentors.
 *
 * @return {firebase.app.App}
 */
function getApp() {
  if (!APPS.default) {
    const config = {
      serviceAccount: SECRET_KEY,
      databaseURL: CLASSMENTORS_DATABASE_URL
    };

    APPS.default = firebase.initializeApp(config);
  }

  return authenticate(APPS.default);
}

/**
 * Get a regular firebase App for Pivotal Expert.
 * @return {?firebase.app.App}
 */
function getPivotalApp() {
  // if (!APPS.pivotal) {
  //   const config = {
  //     apiKey: 'some-key',
  //     authDomain: 'pivotal-expert.firebaseapp.com',
  //     databaseURL: 'https://pivotal-expert.firebaseio.com'
  //   };

  //   APPS.pivotal = firebase.initializeApp(config, 'pivotal');
  // }

  // return APPS.pivotal;
  return null;
}

/**
 * Authenticate worker.
 *
 * @param  {firebase.app.App} app Classmentors firebase App.
 * @return {firebase.app.App}
 */
function authenticate(app) {
  const auth = app.auth();

  if (isWorkerAuthenticated(auth)) {
    return Promise.resolve(app);
  }

  const token = auth.createCustomToken(CLASSMENTORS_PROFILE_WORKER_UID);

  return app.auth().signInWithCustomToken(token).then(() => app);
}

/**
 * Test if the worker is authenticated.
 *
 * @param  {firebase.auth.Auth}  auth Classmentor firebase Auth.
 * @return {boolean}
 */
function isWorkerAuthenticated(auth) {
  return auth.currentUser && auth.currentUser.uid === CLASSMENTORS_PROFILE_WORKER_UID;
}

function wait(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Starts a firebase-queue until the request timeout.
 *
 * @param  {{busyTimeout: number, }}   event   AWS lambda event
 * @param  {object}                    context AWS lambda context
 * @param  {function}                  cb      AWS lambda callback function
 */
exports.startQueueHandler = function(event, context, cb) {
  const firebaseApp = getApp();
  const pivotalFirebaseApp = getPivotalApp();
  const services = servicesModule.servicesFactory(firebaseApp, pivotalFirebaseApp, http.client);
  const handlers = tasks.handlersFactory(services);

  const ref = firebaseApp.database().ref('queue');
  const queue = new Queue(ref, {numWorkers: CLASSMENTORS_PROFILE_WORKER_COUNT}, handlers.profile);
  const close = () => {
    console.log('Starting queue shutdown');

    return queue.shutdown().then(
      () => console.log('Finished queue shutdown')
    );
  };


  ref.child('tasks').once('value').then(snapshot => {
    const timeout = snapshot.exists() ? event.busyTimeout : event.idleTimeout;

    return wait(timeout || 60000);
  }).then(
    () => close()
  ).then(
    () => cb(null, 'timeout')
  ).catch(cb);

  process.on('SIGINT', () => close().then(() => process.exit(0)));
};
