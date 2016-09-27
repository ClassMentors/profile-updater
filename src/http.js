/**
 * profile-updater/src/http.js - define an http client.
 */
'use strict';

const request = require('request-promise-native');

const noop = () => undefined;
const dummyCache = {
  get: noop,
  put: noop
};

function hash(url, params) {
  return [url].concat(
    Object.keys(params).sort().map(k => `${k}${params[k]}`)
  ).join(':');
}

/**
 * Mock Angular $http client (on `get` method implemented yet)
 */
exports.client = {

  /**
   * Send a GET request.
   *
   * @param  {string} url    URL to fetch
   * @param  {?object} config Optional configuration object
   * @return {{data: object, status: number, statusText: string}}
   */
  get(url, config) {
    config = config || {};

    const reqConfig = {
      url: url,
      qs: config.params,
      headers: config.headers,
      resolveWithFullResponse: true,
      simple: false
    };

    const cache = config.cache || dummyCache;
    const key = hash(url, config.params || {});
    const value = cache.get(key);

    if (value) {
      return Promise.resolve(value);
    }

    return request.get(reqConfig).then(response => {
      const contentType = response.headers['content-type'] || '';
      const headers = response.headers;
      const resp = {
        status: response.statusCode,
        statusText: response.statusMessage,
        data: contentType.startsWith('application/json') ? JSON.parse(response.body) : response.body,
        config: config,
        headers: name => headers[name]
      };

      if (resp.status >= 200 && resp.status < 300) {
        return resp;
      }

      return Promise.reject(resp);
    }).then(v => {
      cache.put(key, v);
      return v;
    });
  }

};
