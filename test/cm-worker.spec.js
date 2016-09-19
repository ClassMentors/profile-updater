var expect = require("chai").expect;
var request = require('request')
//var sinon     = require('sinon');
//var worker = require("../src/worker");

var proxyquire = require('proxyquire');
var MockFirebase = require('mockfirebase').MockFirebase;
var mock;
var worker;

describe("Worker", function () {
    beforeEach(function () {
        // load worker with firebase references mocked. 
        worker = proxyquire("../src/cm-worker", {
            firebase: function (url) {
                return (mock = new MockFirebase(url));
            }
        });

        worker.initiateFirebase("http://home.com", "1234");
    });

    it("should resolve tasks with no id in task", function (done) {
        //get_profile(body, data, reject, resolve) ;
        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeCombat": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeCombat" }, reject, resolve);
    });

    it("should catch non-JSON services replies", function (done) {
        var reject = function (msg) { done(); };
        var resolve = function () { };
        var body = "NOT JSON"
        worker.get_profile(body, { "service": "codeCombat" }, reject, resolve);
    });

    it("should process codeCombat task", function (done) {
        //get_profile(body, data, reject, resolve) ;
        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeCombat": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeCombat", "id": "Chris" }, reject, resolve);
    });

    it("should process codeSchool task", function (done) {
        //get_profile(body, data, reject, resolve) ;
        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeSchool": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeSchool", "id": "Chris" }, reject, resolve);
    });



});
