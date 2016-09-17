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
var options={};
var args = process.argv.slice(2);
var firebaseUrl;
var ref;
var queueRef;
var queue;

var initiateFirebase = function(_firebaseUrl, firebaseToken){
    firebaseUrl = _firebaseUrl;
    ref = new Firebase(firebaseUrl);
    queueRef = new Firebase(firebaseUrl+'/queue');
    ref.authWithCustomToken(firebaseToken, function(error, authData) {
    if (error) {
        console.log("Login Failed!", error);
    } else {
        //console.log("Firebase login succeeded!");
        //console.log("Login Succeeded!", authData);
    }
    });  
}

var print_json_and_exit = function(theObject){
  console.log(theObject);
  process.exit(0);
}

var saveFccAchievements = function(profileUrl,classmentorsPublicId, achievements, resolve){
    // FreeCodeCamp profile number does not match up with the listed achievements. 
    // Also need to scrape the profile page due to points not adding up properly. 
    var numAchievements;
    request(profileUrl, function (error, response, body) {
      if(error){
          numAchievements = -1;
      } else {
        var start = body.indexOf(">[ ");
        var stop = body.indexOf(" ]<");
        numAchievements = body.substring(start + 3, stop);
        if (numAchievements== '<!' || numAchievements== 'Ca'){
          numAchievements = -1;
        }
        //console.log("Free Code Camp levels = " + numAchievements); 
      }
   
  


      //var numAchievements = Object.keys(achievements).length;
      var profileUpdate = "classMentors/userProfiles/"+classmentorsPublicId+"/services/freeCodeCamp";
      var achievementsUpdate = "classMentors/userAchievements/"+classmentorsPublicId+"/services/freeCodeCamp";

      var updateData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":numAchievements};    
      //Update the user profile.  
      ref.child(profileUpdate).update(updateData);
      
      var achievementData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":numAchievements, 'achievements':achievements};
      //Update the user achievements.  
      ref.child(achievementsUpdate).update(achievementData);
      
      profileUpdateCount += 1;
      console.log(profileUpdateCount+". "+classmentorsPublicId+" FreeCodeCamp updated to "+numAchievements);  

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
      var profileUpdate = "classMentors/userProfiles/"+classmentorsPublicId+"/services/freeCodeCamp";
      var achievementsUpdate = "classMentors/userAchievements/"+classmentorsPublicId+"/services/freeCodeCamp";
      var updateData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":-1};    
      ref.child(profileUpdate).update(updateData);
      ref.child(achievementsUpdate).update(achievementData);
      resolve();
      //return; 
    }
    else { 
      var achievements = {}
      for(var i=0; i<arr.length; i++){
        
        if(arr[i]['name']){
          var newKey = arr[i]['name'].toLowerCase().split(" ").join("-");
          //console.log(newKey, "---->",arr[i]);
          achievements[newKey] = arr[i];
        }
        else{
          console.log(arr[i]);
        }
        
      }	
      //console.log("There were",Object.keys(achievements).length, "achievements.");
      
      if(classmentorsPublicId == undefined){
        console.log(achievements);
        process.exit(0);
      }
      else{
         //console.log("Should save data here for",classmentorsPublicId);
         saveFccAchievements(profileUrl, classmentorsPublicId, achievements, resolve);
      }

  }
  });
}


// node cm-worker.js -t <secret>
if(args[0] == '-t'){
  console.log("creating token");
  var FirebaseTokenGenerator = require("firebase-token-generator");
  var tokenGenerator = new FirebaseTokenGenerator(args[1]);
  // By default, create tokens that expire in June 2017
  var token = tokenGenerator.createToken({ uid: "queue-worker", some: "arbitrary", data: "here" },
                                         { expires:1497151174 });
  console.log(token);
  process.exit(0);
  
}
// node cm-worker.js -fcc <fccProfileURL>
else if(args[0] == '-fcc'){
  var profileUrl = args[1];
  fetchFreeCodeCampProfileObject(profileUrl);

}
else if(args.length>1) {
  for(var i=0; i<args.length; i++){
      var temp = args[i].split("=")
      options[temp[0]] = temp[1]
      //console.log(temp);  
  }
  initiateFirebase(options['firebaseUrl'], options['token']);
  console.log("Listending to url "+options['firebaseUrl']);
  console.log("with token "+options['token']);

}

// Exit on ctrl-c
// or kill -s SIGINT [process_id] from termina. 
// or pass in a signal from a queue. 
process.on('SIGINT', function () {
  queue.shutdown().then(function() {
    console.log('Got a SIGINT. Goodbye cruel world');
    console.log('Finished queue shutdown');
    process.exit(0);
  });
});

var get_service_url = function (service, serviceID) {
  var theUrl = "";
  //console.log("Fetching serviceID "+serviceID+" on "+service);
  if (service == "freeCodeCamp") {
    //console.log("Using freeCodeCamp url " + theUrl);
    theUrl = "https://www.freecodecamp.com/" + serviceID;
  }
 
  else if (service == "codeCombat") {
     theUrl = "https://codecombat.com/db/user/" + serviceID + "/level.sessions?project=state.complete,levelID,levelName";
     //theUrl= "https://codecombat.com/db/user/"+serviceID;
    //console.log("Using codeCombat url "+theUrl); 
  }
  
  else if (service == "pivotalExpert") {
    //theUrl = "https://pivotal-expert.firebaseio.com/pivotalExpert/userProfiles/Chris/userAchievements";
    theUrl = "https://pivotal-expert.firebaseio.com/pivotalExpert/userProfiles/"+serviceID+"/userAchievements.json";
    //console.log("Using PivotalEpert url "+theUrl); 
  }
  else if (service == "codeSchool") {
    //console.log("Using codeSchool url");
    theUrl = "https://www.codeschool.com/users/" + serviceID + ".json";
  }
  return theUrl;
}

var get_achievements_from_response = function (service, body) {
  var totalAchievements = 0;
  var error = null;
  
  if (service == "freeCodeCamp") {

    // replaced. 
    //var start = body.indexOf(">[ ");
    //var stop = body.indexOf(" ]<");
    //totalAchievements = body.substring(start + 3, stop);
    //if (totalAchievements == '<!'){
    //  console.log("Make a change here.");
    // totalAchievements = -1;
    // }
    //console.log("Free Code Camp levels = " + totalAchievements);
  }
  else if(service == "pivotalExpert"){
    var jsonObject = JSON.parse(body);
    //console.log(body);
    var totalAchievements = 0;
    for (var k in jsonObject) {
       if (jsonObject.hasOwnProperty(k) && jsonObject[k]==true) totalAchievements++;
    }

  }
  else if (service == "codeCombat") {
    /* Replaced. 
    var jsonObject;

    try {
      jsonObject = JSON.parse(body);
    } catch (e) {
      console.log("Error parsing json from codeCombat "+e);
    }

    if (jsonObject) {
      //Currently includes stat.complete.false levels
      console.log(" ****** Code Combat levels = " + jsonObject.length);
      console.log(jsonObject);

      
      var theCount = 0;
      for (var i = 0; i < jsonObject.length; i++) {
        if (jsonObject[i].state.complete == true) {
          theCount += 1;
        }
      }
      //console.log("Completed Code Combat levels = " + theCount);
      totalAchievements = theCount;
    }
    */
  }

  else if (service == "codeSchool") {

    var jsonObject;

    try {
      jsonObject = JSON.parse(body);
    } catch (e) {
      if(e.name ="SyntaxError"){
        var message = "User Code School profile is not public."
        console.log(message);
        error = message;
        totalAchievements = -1;
      }
      //console.log("Error parsing json from codeSchool. "+e);
      //console.log(e);
    }

    if (jsonObject) {
      var badges = jsonObject['badges'];
      //console.log("Code School Badges earned " + badges.length);
      totalAchievements = badges.length;
    }
  }

  //console.log("Fetched totalAchievements " + totalAchievements+ " on "+service); // Show the HTML for homepage.
  
  return totalAchievements;
  //return {totalAchievements:totalAchievements, error: error};
}

var update_profile_and_clear_task = function (err, data, reject, resolve) {
  if (err) {
    console.log("Error updating " + err);
    reject(err);
  } else {
    //console.log("Successfully updated. Resolving task. " + JSON.stringify(data));
    resolve(data);
    data["updated"] = Firebase.ServerValue.TIMESTAMP;
    ref.child('logs/profileUpdates').push(data); //, function (err) {if (err){ } else {}}); 
    profileUpdateCount += 1
    var message = profileUpdateCount+". "+data['id']+" "+data['service']+" updated to "+data['count']
    var offset = 50-message.length;
    if (offset<1) offset=5;
    console.log( message + Array(offset).join(" ")+Date());
    
  }
}

var update_achievements_and_clear_queue = function (location, theData, data, reject, resolve) {
  // data = {"id":"cboesch","service":"pivotalExpert","count":1}
  var profileUpdate = "classMentors/userProfiles/"+data['id']+"/services/"+data['service'];
  var updateData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":data['count']};
  //console.log("Will update "+profileUpdate+" with "+JSON.stringify(updateData));
  
  //Update the user profile as well.  
  ref.child(profileUpdate).update(updateData);
  
  // update the userAchievements as well. Only the worker can edit this location. 
  ref.child(location).set(theData, function (err) {
    update_profile_and_clear_task(err, data, reject, resolve);
  });

}

var fetch_service_url = function (theUrl, data, service, serviceID, reject, resolve, error, response, body, callback) {
  //console.log("requested url " + theUrl + " since the service is " + service);
  if (!error && response.statusCode == 200) {

    var totalAchievements = get_achievements_from_response(service, body);
    data.count = totalAchievements;
    var location = "classMentors/userAchievements/" + data.id + "/services/" + service;
    var theData = { "totalAchievements": data.count, "id": serviceID };

    callback(location, theData, data, reject, resolve);
  }
  else {
    console.log("There was an error fetching " + theUrl + " status code " + response.statusCode + " error " + error);
    data.count = -1; 
    var location = "classMentors/userAchievements/" + data.id + "/services/" + service;
    var theData = { "totalAchievements": data.count, "id": serviceID };
    callback(location, theData, data, reject, resolve);
  }
}

var updateFreeCodeCamp = function(classMentorsId, serviceID, resolve){
    //console.log("Update Free Code Camp for ClassMentors user",classMentorsId,"with fcc id", serviceID);
    fetchFreeCodeCampProfileObject("https://www.freecodecamp.com/"+serviceID, classMentorsId, resolve);
}

var updateCodeCombat = function(classmentorsPublicId, serviceID, resolve){
  //console.log("Update Code Combat for ClassMentors user",classmentorsPublicId,"with codeCombat id", serviceID);
  var theUrl = "https://codecombat.com/db/user/" + serviceID + "/level.sessions?project=state.complete,levelID,levelName";
  request(theUrl, function (error, response, body) {
    
    if (error) {
        console.log(error);
        //console.log("the body", body);
        //resolve();
    }
    else {
      var profileUpdate = "classMentors/userProfiles/"+classmentorsPublicId+"/services/codeCombat";
      var achievementsUpdate = "classMentors/userAchievements/"+classmentorsPublicId+"/services/codeCombat";

      var jsonObject;
      var error = false;

      try {
        jsonObject = JSON.parse(body);
        achievements = {};
        var theCount = 0;
        for (var i = 0; i < jsonObject.length; i++) {
          if (jsonObject[i].state.complete == true) {
            var item = {"name":jsonObject[i]['levelName'], "complete":true};
            achievements[jsonObject[i]['levelID']] = item;
            theCount += 1;
          }
        }
              //console.log(achievements);
        // Update user profile
        // Update achievements
        var numAchievements = theCount;

        var updateData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":numAchievements};    
        //Update the user profile.  
        ref.child(profileUpdate).update(updateData);
        
        var achievementData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":numAchievements, 'achievements':achievements};
        //Update the user achievements.  
        ref.child(achievementsUpdate).update(achievementData);
        
        profileUpdateCount += 1;
        console.log(profileUpdateCount+". "+classmentorsPublicId+" Code Combat updated to "+numAchievements);  
      
      } catch (e) {
        console.log("Error parsing json from codeCombat. Setting achievements to -1. "+e);
        
        var achievementData = {"lastUpdate":Firebase.ServerValue.TIMESTAMP, "totalAchievements":-1};
        //Update the user achievements.  
        ref.child(profileUpdate).update(achievementData);
        ref.child(achievementsUpdate).set(achievementData);
 
      }
  
  }
  });    
  
  resolve();
}

var get_profile = function (service_response_body, task_data, reject, resolve) {
  //console.log("task data",task_data);
  var classMentorsId = task_data.id;
  var jsonObject = {};
  try {
    jsonObject = JSON.parse(service_response_body);
  } catch (e) {
      console.log("Error parsing json from "+task_data.service+" "+e);
    }
  var service = task_data.service;
  var services = jsonObject['services']
  
  //console.log("services",services);
  // If the user does not have the service it will be skipped. 
  if(!services || !services.hasOwnProperty(service)){
    console.log(task_data['id']+" has not registered for " + task_data['service']);
    resolve("User has not registered for " + service);
  }
  else {
    var serviceID = services[service]['details']['id'];

    var theUrl = get_service_url(service, serviceID);
    // Reject bad requests
    if (theUrl == "") {
      console.log("Resolving unsupported service. "+service+" "+serviceID);
      resolve("Non-supported service " + service);
      //reject("Non-supported service " + service);
    } else if(service=="freeCodeCamp") {
         //console.log("Updating FreeCodeCamp achievements");
         updateFreeCodeCamp(classMentorsId, serviceID, resolve)
    
    } else if(service=="codeCombat") {
         //console.log("Updating Code Combat achievements");
         updateCodeCombat(classMentorsId, serviceID, resolve);
    } else {
    //Fetch the service url
      //console.log("requesting url ", theUrl)  
      request(theUrl, function (error, response, body) {
        if (error) console.log(error);
        //console.log("the body", body);
        fetch_service_url(theUrl, task_data, service, serviceID, reject, resolve, error, response, body, update_achievements_and_clear_queue);
      });
    }

  }
}

// Called by Queue when new tasks are present. 
var process_task = function (data, progress, resolve, reject) {
  //console.log("service " + data.service + " for user " + data.id);
  var service = data.service;
  var user = data.id;

  //Fetch the userProfile from ClassMentors
  var userProfileUrl = firebaseUrl+"/classMentors/userProfiles/" + user + ".json";
  //console.log("Fetching profile "+userProfileUrl);  
  request(userProfileUrl, function (error, response, body) {
    //TODO: handle profile fetch error. 
    //TODO: check that response is valid. 
    //TODO: If valid, process profile. 
    //console.log('Get profile.');
    //console.log("profile body");
    //console.log(body);
    get_profile(body, data, reject, resolve);

  });
}

 var handler = function (event, context) {
    var eventIdleTimeout = 50000
    var eventBusyTimeout = 60000
    if(event['idleTimeout']){
       eventIdleTimeout = event['idleTimeout'];
       console.log("Updating idleTimeout to ",eventIdleTimeout );
    }
    if(event['busyTimeout']){
       eventBusyTimeout = event['busyTimeout'];
       console.log("Updating busyTimeout to ",eventBusyTimeout );
    }
    if(event['debug']){
      console.log( "event", event );
      //console.log(context);
      console.log(process.env);
    }
    var firebaseUrl = process.env.FIREBASE_URL;
    var firebaseToken = process.env.FIREBASE_TOKEN;
    if(firebaseUrl && firebaseToken){
      //console.log("--------");
      //console.log(firebaseUrl);
      //console.log(firebaseToken);
      initiateFirebase(firebaseUrl, firebaseToken);
      var data = {"from":"handler", "updated":Firebase.ServerValue.TIMESTAMP};
      ref.child('queue/tasks').once('value', function (snapshot) {
          // code to handle new value
          var tasks = snapshot.val();
          var delay = eventIdleTimeout;
          // If tasks, use the busyTimeout. 
          if(tasks){
              console.log("There were tasks. Using busy timeout.");
              var delay = eventBusyTimeout;
          }
          console.log("Starting queue for "+delay+"ms.")  
          var options = {
                'specId': 'lambda-worker',
                'numWorkers': 5
          };
          queue = new Queue(queueRef, process_task);
          //queue.addWorker();
          console.log("numWorkers",queue.getWorkerCount());    
          setTimeout(function() { queue.shutdown().then(function () {
                  console.log('Finished queue shutdown');
                  context.done();
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
if (require.main === module && args[0]!="-fcc") {
  queue = new Queue(queueRef, process_task);

  // Export modules if we aren't running the worker so that we can test functions. 
} else {

  module.exports = {
    "handler": handler,
    "initiateFirebase":initiateFirebase,
    "get_service_url": get_service_url,
    "get_achievements_from_response": get_achievements_from_response,
    "update_achievements_and_clear_queue": update_achievements_and_clear_queue,
    "fetch_service_url": fetch_service_url,
    "process_task": process_task,
    "get_profile": get_profile,
    "update_profile_and_clear_task": update_profile_and_clear_task
  }
}


