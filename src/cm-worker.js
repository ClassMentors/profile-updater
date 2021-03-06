var Queue = require('firebase-queue'),
  Firebase = require('firebase'),
  http = require('http'),
  request = require('request');

/*
node cm-worker.js -t <secret>   // to create worker token
node cm-worker.js -fcc <fccProfileURL> // to download a freeCodeCamp profile. 

node-lambda will use the defaults in the .env file for testing
node-lambda run

Pass environment secrets to AWS using the deploy.env file. 
node-lambda deploy -f deploy.env
*/

var profileUpdateCount = 0
var options = {};
var args = process.argv.slice(2);
var firebaseUrl;
var ref;
var queueRef;
var queue;
var loggingLevel = "INFO";
var workerID = "local"

var log = function(message, data, callback){
    // If no callback provided, then pass a default callback to the firebase.push() 
    if(!callback) callback = function(){};

    var workerLog = "logs/worker";
    var logData = {}
    if(data) logData = data; 
    logData['message'] = message; 
    logData['timestamp'] = Firebase.ServerValue.TIMESTAMP;
    //logData['level'] = "INFO";
    logData['workerID'] = workerID;
    
    if(!logData.hasOwnProperty('level')) logData['level'] = "INFO";
     
    if(logData['level'] != "DEBUG" || loggingLevel=="DEBUG"){
      //console.log(logData);  
      ref.child(workerLog).push(logData, callback);
    } else {
      // Not logging debug values. 
    }
    // If any functions need to wait for callbacks to finish. 

}
var logger = {
  "log":log
}

var initiateFirebase = function (_firebaseUrl, firebaseToken) {
  firebaseUrl = _firebaseUrl;
  ref = new Firebase(firebaseUrl);
  queueRef = new Firebase(firebaseUrl + '/queue');
  ref.authWithCustomToken(firebaseToken, function (error, authData) {
    if (error) {
      console.log("Login Failed!", error);
    } else {
      //console.log("Firebase login succeeded!");
      //console.log("Login Succeeded!", authData);
    }
  });
  // TODO: Need to add TIMESTAMP to FirebaseMock
  // No ServerValue in the MockFirebase
 if(!Firebase.ServerValue){ 
      Firebase.ServerValue = {'TIMESTAMP':"TEST_TIMESTAMP"};
  }
}

var saveFccAchievements = function (profileUrl, classmentorsPublicId, achievements, resolve) {
  // FreeCodeCamp profile number does not match up with the listed achievements. 
  // Also need to scrape the profile page due to points not adding up properly. 
  var numAchievements;
  request(profileUrl, function (error, response, body) {
    if (error) {
      numAchievements = -1;
    } else {
      var start = body.indexOf(">[ ");
      var stop = body.indexOf(" ]<");
      numAchievements = body.substring(start + 3, stop);
      if (numAchievements == '<!' || numAchievements == 'Ca') {
        numAchievements = -1;
      }
      //console.log("Free Code Camp levels = " + numAchievements); 
    }

    var profileUpdate = "classMentors/userProfiles/" + classmentorsPublicId + "/services/freeCodeCamp";
    var achievementsUpdate = "classMentors/userAchievements/" + classmentorsPublicId + "/services/freeCodeCamp";

    var updateData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements };
    //Update the user profile.  
    ref.child(profileUpdate).update(updateData);

    var achievementData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements, 'achievements': achievements };
    //Update the user achievements.  
    ref.child(achievementsUpdate).update(achievementData);

    profileUpdateCount += 1;
    console.log(profileUpdateCount + ". " + classmentorsPublicId + " FreeCodeCamp updated to " + numAchievements);

    resolve();
  });
}
var fetchFreeCodeCampProfileObject = function (profileUrl, classmentorsPublicId, resolve) {
  var xray = require('x-ray');
  var Xray = new xray();
  Xray(profileUrl, 'table.table-striped tr', [{
    name: 'td:nth-child(1)',
    complete: 'td:nth-child(2)'
  }])(function (err, arr) {
    if (err) {
      // TODO: Resolve bad urls and set total to -1. 
      console.log('xray error:  ' + err);
      var profileUpdate = "classMentors/userProfiles/" + classmentorsPublicId + "/services/freeCodeCamp";
      var achievementsUpdate = "classMentors/userAchievements/" + classmentorsPublicId + "/services/freeCodeCamp";
      var updateData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": -1 };
      ref.child(profileUpdate).update(updateData);
      ref.child(achievementsUpdate).update(achievementData);
      resolve();
      //return; 
    }
    else {
      var achievements = {}
      for (var i = 0; i < arr.length; i++) {

        if (arr[i]['name']) {
          var newKey = arr[i]['name'].toLowerCase().split(" ").join("-");
          //console.log(newKey, "---->",arr[i]);
          achievements[newKey] = arr[i];
        }
        else {
          console.log(arr[i]);
        }

      }
      //console.log("There were",Object.keys(achievements).length, "achievements.");

      if (classmentorsPublicId == undefined) {
        console.log(achievements);
        process.exit(0);
      }
      else {
        //console.log("Should save data here for",classmentorsPublicId);
        saveFccAchievements(profileUrl, classmentorsPublicId, achievements, resolve);
      }
    }
  });
}


// node cm-worker.js -t <secret>
if (args[0] == '-t') {
  console.log("creating token");
  var FirebaseTokenGenerator = require("firebase-token-generator");
  var tokenGenerator = new FirebaseTokenGenerator(args[1]);
  // By default, create tokens that expire in June 2017
  var token = tokenGenerator.createToken({ uid: "queue-worker", some: "arbitrary", data: "here" },
    { expires: 1497151174 });
  console.log(token);
  process.exit(0);

}
// node cm-worker.js -fcc <fccProfileURL>
else if (args[0] == '-fcc') {
  var profileUrl = args[1];
  fetchFreeCodeCampProfileObject(profileUrl);

}
else if (args.length > 1) {
  for (var i = 0; i < args.length; i++) {
    var temp = args[i].split("=")
    options[temp[0]] = temp[1]
    //console.log(temp);  
  }
  initiateFirebase(options['firebaseUrl'], options['token']);
  console.log("Listending to url " + options['firebaseUrl']);
  console.log("with token " + options['token']);

}

// Exit on ctrl-c
process.on('SIGINT', function () {
  queue.shutdown().then(function () {
    console.log('Got a SIGINT. Goodbye cruel world');
    console.log('Finished queue shutdown');
    process.exit(0);
  });
});

var updateFreeCodeCamp = function (classMentorsId, serviceID, resolve) {
  //console.log("Update Free Code Camp for ClassMentors user",classMentorsId,"with fcc id", serviceID);
  fetchFreeCodeCampProfileObject("https://www.freecodecamp.com/" + serviceID, classMentorsId, resolve);
}

var updatePivotalExpert = function (classmentorsPublicId, serviceID, resolve) {
  //Get the publicID before continuing. 
  var theAuthUserKey = null;//"google:110893970871115341770";

  var theAuthUrl = "https://pivotal-expert.firebaseio.com/auth/usedLinks/" + serviceID + ".json";
  request(theAuthUrl, function (error, response, body) {
      var theAuthUserKey = JSON.parse(body);// body;
      console.log("Fetched AuthUserKey "+theAuthUserKey);  
      //var theAuthUserKey = "google:110893970871115341770";
      //var theUrl = "https://www.codeschool.com/users/" + serviceID + ".json";
      var theUrl = "https://pivotal-expert.firebaseio.com/userProfiles/"+theAuthUserKey+"/courseProgress.json";
      //var theUrl = "https://www.codeschool.com/users/" + serviceID + ".json";
      console.log("Fetching userProfile details from "+theUrl);
      request(theUrl, function (error, response, body) {
        if (error) {
          console.log(error);
          //console.log("the body", body);
          //resolve();
        } else {

          var jsonObject;
          var totalAchievements = -1;
          var achievements = {}
          try {
            jsonObject = JSON.parse(body);
          } catch (e) {
            if (e.name = "SyntaxError") {
              var message = "User pivotal expert profile is not public."
              console.log(message);
              error = message;
              //totalAchievements = -1;

            }
            //console.log("Error parsing json from pivotal expert. "+e);
            //console.log(e);
          }

          if (jsonObject) {
            numAchievements = 0;
            for(achievementKey in jsonObject){
              numAchievements += 1;
              var item = { "name": "No PE names yet", "complete": true };
              achievements[achievementKey] = item;
              //console.log(achievementKey);
            }

            var profileUpdate = "classMentors/userProfiles/" + classmentorsPublicId + "/services/pivotalExpert";
            var achievementsUpdate = "classMentors/userAchievements/" + classmentorsPublicId + "/services/pivotalExpert";

            var updateData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements };
            //Update the user profile.  
            ref.child(profileUpdate).update(updateData);

            var achievementData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements, 'achievements': achievements };
            //Update the user achievements.  
            ref.child(achievementsUpdate).update(achievementData);

            profileUpdateCount += 1;
            console.log(profileUpdateCount + ". " + classmentorsPublicId + " Pivotal Expert updated to " + numAchievements);

          }

        }
        resolve();
      });

  });
}


var updateCodeSchool = function (classmentorsPublicId, serviceID, resolve) {
  var theUrl = "https://www.codeschool.com/users/" + serviceID + ".json";
  request(theUrl, function (error, response, body) {

    if (error) {
      console.log(error);
      //console.log("the body", body);
      //resolve();
    } else {

      var jsonObject;
      var totalAchievements = -1;
      try {
        jsonObject = JSON.parse(body);
      } catch (e) {
        if (e.name = "SyntaxError") {
          var message = "User Code School profile is not public."
          console.log(message);
          error = message;
          //totalAchievements = -1;

        }
        //console.log("Error parsing json from codeSchool. "+e);
        //console.log(e);
      }

      if (jsonObject) {
        var arr = jsonObject['badges'];
        //console.log("Code School Badges earned " + arr.length);
        totalAchievements = arr.length;

        //TODO: save achievements and achievement count. 
        //console.log(arr);
        var achievements = {}
        var theCount = 0;
        for (var i = 0; i < arr.length; i++) {

          if (arr[i]['name']) {
            var newKey = arr[i]['name'].toLowerCase().split(" ").join("-").split(".").join("-");
            //console.log(newKey, "---->",arr[i]);
            var item = { "name": arr[i]['name'], "complete": true };
            achievements[newKey] = item;
            theCount += 1;
          }
          else {
            // no name parameter
            //console.log(arr[i]);
          }

        }
        //console.log(achievements);
        var numAchievements = theCount;
        var profileUpdate = "classMentors/userProfiles/" + classmentorsPublicId + "/services/codeSchool";
        var achievementsUpdate = "classMentors/userAchievements/" + classmentorsPublicId + "/services/codeSchool";

        var updateData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements };
        //Update the user profile.  
        ref.child(profileUpdate).update(updateData);

        var achievementData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements, 'achievements': achievements };
        //Update the user achievements.  
        ref.child(achievementsUpdate).update(achievementData);

        profileUpdateCount += 1;
        console.log(profileUpdateCount + ". " + classmentorsPublicId + " Code School updated to " + numAchievements);

      }

    }
    resolve();
  });


}
var updateCodeCombat = function (classmentorsPublicId, serviceID, resolve) {
  //console.log("Update Code Combat for ClassMentors user",classmentorsPublicId,"with codeCombat id", serviceID);
  var slugifiedID = serviceID.toLowerCase().replace(" ","-");
  var theUrl = "https://codecombat.com/db/user/" + slugifiedID + "/level.sessions?project=state.complete,levelID,levelName";
  request(theUrl, function (error, response, body) {

    if (error) {
      console.log(error);
      //console.log("the body", body);
      //resolve();
    }
    else {
      var profileUpdate = "classMentors/userProfiles/" + classmentorsPublicId + "/services/codeCombat";
      var achievementsUpdate = "classMentors/userAchievements/" + classmentorsPublicId + "/services/codeCombat";

      var jsonObject;
      var error = false;

      try {
        jsonObject = JSON.parse(body);
        achievements = {};
        var theCount = 0;
        for (var i = 0; i < jsonObject.length; i++) {
          if (jsonObject[i].state.complete == true) {
            var item = { "name": jsonObject[i]['levelName'], "complete": true };
            achievements[jsonObject[i]['levelID']] = item;
            theCount += 1;
          }
        }
        //console.log(achievements);
        // Update user profile
        // Update achievements
        var numAchievements = theCount;

        var updateData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements };
        //Update the user profile.  
        ref.child(profileUpdate).update(updateData);

        var achievementData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": numAchievements, 'achievements': achievements };
        //Update the user achievements.  
        ref.child(achievementsUpdate).update(achievementData);

        profileUpdateCount += 1;
        console.log(profileUpdateCount + ". " + classmentorsPublicId + " Code Combat updated to " + numAchievements);

      } catch (e) {
        //console.log("Error parsing json from codeCombat. Setting achievements to -1. " + e);
        var achievementData = { "lastUpdate": Firebase.ServerValue.TIMESTAMP, "totalAchievements": -1 };
        //Update the user achievements.  
        ref.child(profileUpdate).update(achievementData);
        ref.child(achievementsUpdate).set(achievementData);

      }

    }
  });

  resolve();
}

var get_profile = function (service_response_body, task_data, reject, resolve) {
  var classMentorsId = task_data.id;
  var jsonObject = {};
  try {
    jsonObject = JSON.parse(service_response_body);
  } catch (e) {
    //var errorMessage = "Error parsing json from "+task_data.service+" "+e;
    //console.log(errorMessage);
    reject("message from me");
    return;
  }

  var service = task_data.service;
  var services = jsonObject['services']

  //console.log("services",services);
  // If the user does not have the service it will be skipped. 
  if (!services || !services.hasOwnProperty(service)) {
    //console.log(task_data['id']+" has not registered for " + task_data['service']);
    resolve("User has not registered for " + service);
  }
  else {

    var serviceID = services[service]['details']['id'];
    //var theUrl = get_service_url(service, serviceID);
    // Reject bad requests
    if (service == "freeCodeCamp") {
      // console.log("Updating FreeCodeCamp achievements");
      updateFreeCodeCamp(classMentorsId, serviceID, resolve)
    } else if (service == "codeCombat") {
      //console.log("Updating Code Combat achievements");
      updateCodeCombat(classMentorsId, serviceID, resolve);
    } else if (service == "codeSchool") {
      //console.log("Updating Code School achievements");
      updateCodeSchool(classMentorsId, serviceID, resolve);
    }
     else if (service == "pivotalExpert") {
      //console.log("Updating Pivotal Expert achievements");
      updatePivotalExpert(classMentorsId, serviceID, resolve);
    }
    // Add support for Pivotal Expert here. 
    else {
      console.log("Resolving unsupported service. " + service + " " + serviceID);
      resolve("Non-supported service " + service);

    }

  }
}

// Called by Queue when new tasks are present. 
var process_task = function (data, progress, resolve, reject) {
  //console.log("service " + data.service + " for user " + data.id);
  var service = data.service;
  var user = data.id;

  //Fetch the userProfile from ClassMentors
  var userProfileUrl = firebaseUrl + "/classMentors/userProfiles/" + user + ".json";
  //console.log("Fetching profile "+userProfileUrl);  
  request(userProfileUrl, function (error, response, body) {
    get_profile(body, data, reject, resolve);

  });
}

var handler = function (event, context) {
  var eventIdleTimeout = 50000
  var eventBusyTimeout = 60000
  var start = new Date();
  var eventIdleTimeout = 30000
  var eventBusyTimeout = 45000
  var firebaseUrl = process.env.FIREBASE_URL;
  var firebaseToken = process.env.FIREBASE_TOKEN;
  if(context.awsRequestId){
      workerID = context.awsRequestId;
  }
  initiateFirebase(firebaseUrl, firebaseToken);
  if (event['idleTimeout']) {
    eventIdleTimeout = event['idleTimeout'];
    console.log("Updating idleTimeout to ", eventIdleTimeout);
    logger.log("Updating idleTimeout", {"idleTimeout":eventIdleTimeout, "level":"DEBUG"});
  }
  if (event['busyTimeout']) {
    eventBusyTimeout = event['busyTimeout'];
    console.log("Updating busyTimeout to ", eventBusyTimeout);
    logger.log("Updating busyTimeout", {"busyTimeout":eventBusyTimeout, "level":"DEBUG"});
  }
  if (event['debug']) {
    console.log("event", event);
    //console.log(context);
    console.log(process.env);
    loggingLevel="DEBUG";
    logger.log("event", {'level':"DEBUG", "event":event});
    logger.log("process.env", {"process":process.env, "level":"DEBUG"});
  }
  var firebaseUrl = process.env.FIREBASE_URL;
  var firebaseToken = process.env.FIREBASE_TOKEN;
  if (firebaseUrl && firebaseToken) {
    //console.log("--------");
    //console.log(firebaseUrl);
    //console.log(firebaseToken);
    //logger.log("--------");
    //logger.log(firebaseUrl);
    //logger.log(firebaseToken);
    initiateFirebase(firebaseUrl, firebaseToken);
    var data = { "from": "handler", "updated": Firebase.ServerValue.TIMESTAMP };
    //var data = { "from": "handler", "updated": Firebase.ServerValue.TIMESTAMP };
    ref.child('queue/tasks').once('value', function (snapshot) {
      // code to handle new value
      var tasks = snapshot.val();
      var delay = eventIdleTimeout;
      // If tasks, use the busyTimeout. 
      if (tasks) {
        console.log("There were tasks. Using busy timeout.");
        //logger.log("There were tasks. Using busy timeout.");
        var delay = eventBusyTimeout;
      }
      console.log("Starting queue for " + delay + "ms.")
      logger.log("starting",{"plannedDuration": delay, "level":"INFO"});
      queue = new Queue(queueRef, process_task);
      queue.addWorker();
      queue.addWorker();
      queue.addWorker();
      console.log("numWorkers", queue.getWorkerCount());
      logger.log("numWorkers", {"workers":queue.getWorkerCount(), "level":"DEBUG"});
      setTimeout(function () {
        queue.shutdown().then(function () {
          console.log('Finished queue shutdown');
          context.done();
          var stop = new Date();
          var duration = stop - start;
          // pass the context done method to the logger to end process after logging.   
          logger.log('shutdown',{"duration":duration}, context.done);          
        });
      }, delay);


    }, function (err) {
      console.log(err);
      // code to handle read error
      context.done();
    });


  } else {
    console.log("firebaseUrl or firebaseToken missing. ");
    context.done();
  }
  //context.done();
}

// Do not run the server when loading as a module. 
if (require.main === module && args[0] != "-fcc") {
  queue = new Queue(queueRef, process_task);

  // Export modules if we aren't running the worker so that we can test functions. 
} else {

  module.exports = {
    "handler": handler,
    "initiateFirebase": initiateFirebase,
    "process_task": process_task,
    "get_profile": get_profile,
    "log":log
  }
}