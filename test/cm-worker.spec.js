var expect    = require("chai").expect;
var request    = require('request')
//var sinon     = require('sinon');
//var worker = require("../src/worker");

var proxyquire   = require('proxyquire');
var MockFirebase = require('mockfirebase').MockFirebase;
var mock;
// load worker with firebase references mocked. 
var worker = proxyquire("../src/cm-worker", {
  firebase: function (url) {
    return (mock = new MockFirebase(url));
  }
});
worker.initiateFirebase("http://home.com", "1234");
//mock.flush();
// data is logged

describe("Worker", function() {
    
    //Todo: Add tests
    it("get profile", function () {
        //get_profile(body, data, reject, resolve) ;
        var body = JSON.stringify({"services":{"codeCombat":{"details":{"id":"Chris"}}}});
        worker.get_profile( body, {"service":"codeCombat"}, function (data) { }, function (data) { });
    });
    // Need to pass in done to test that callbacks are executed.
    
});
