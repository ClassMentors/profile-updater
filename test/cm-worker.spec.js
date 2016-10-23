var expect = require("chai").expect;
//var request = require('request')
var sinon     = require('sinon');
//var worker = require("../src/worker");

var proxyquire = require('proxyquire');
var MockFirebase = require('mockfirebase').MockFirebase;

request = sinon.stub();

var worker;
var mock;
describe("Worker", function () {
    beforeEach(function () {
        // load worker with firebase references mocked.

        worker = proxyquire("../src/cm-worker", {
            'request': request,
            firebase: function (url) {
                return (mock = new MockFirebase(url));
            }
        });
        worker.initiateFirebase("http://home.com", "1234");
        //mock.flush();
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
    
    it("should have a logger function", function () {
        //worker.log(message, data, callback);
        var message = "testMessage";
        worker.log(message, {'test':'data'});
    });
   
    it("should process a codeSchool task", function (done) {
        var serviceID = "Chris";
        var expectedEndpoint = "https://www.codeschool.com/users/" + serviceID + ".json";
        var request_body = JSON.stringify({
            badges: [{"name":"name1"},{"name":"name2"}]
        });
        request.withArgs(expectedEndpoint).yields(null, null, request_body);

        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeSchool": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeSchool", "id": "Chris" }, reject, resolve);
    });
 
    it("should process a codeCombat task", function (done) {
        var serviceID = "Chris";
        var expectedEndpoint = "https://codecombat.com/db/user/" + serviceID + "/level.sessions?project=state.complete,levelID,levelName";
        var request_body = JSON.stringify([
            {"state":{"complete":true}, "levelID":"levelID", "levelName":"levelName"}
        ]);
        request.withArgs(expectedEndpoint).yields(null, null, request_body);

        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeCombat": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeCombat", "id": "Chris" }, reject, resolve);
    });

    it("should process a bad codeCombat url response", function (done) {
        var serviceID = "Chris";
        var expectedEndpoint = "https://codecombat.com/db/user/" + serviceID + "/level.sessions?project=state.complete,levelID,levelName";
        var request_body = JSON.stringify("NOT AN ARRAY");
        request.withArgs(expectedEndpoint).yields(null, null, request_body);

        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "codeCombat": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "codeCombat", "id": "Chris" }, reject, resolve);
    });

    it("should process a pivotalExpert task", function (done) {
        var serviceID = "Chris";
        //https://pivotal-expert.firebaseio.com/auth/usedLinks/chris
        //https://pivotal-expert.firebaseio.com/userProfiles/google:110893970871115341770/courseProgress
        var expectedEndpoint = "https://pivotal-expert.firebaseio.com/auth/usedLinks/" + serviceID + ".json";
        var request_body = JSON.stringify("google:110893970871115341770");
        request.withArgs(expectedEndpoint).yields(null, null, request_body);

        var expectedEndpoint2 = "https://pivotal-expert.firebaseio.com/userProfiles/google:110893970871115341770/courseProgress.json";
        var request_body = JSON.stringify({"-KUbGtk0pSazJg6zl9XL":{"completedAt":1477207992388,"text":"10/23/2016, 3:33:12 PM"},
    "-keyTwo":{"completedAt":1477207992488,"text":"10/23/2016, 3:35:12 PM"}});
        request.withArgs(expectedEndpoint2).yields(null, null, request_body);


        var reject = function (msg) { };
        var resolve = function () { done(); };
        var body = JSON.stringify({ "services": { "pivotalExpert": { "details": { "id": "Chris" } } } });
        worker.get_profile(body, { "service": "pivotalExpert", "id": "Chris" }, reject, resolve);
    });

});
