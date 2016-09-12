# profile-updater
Updates the profiles on a ClassMentors instance by monitoring a Firebase queue. 

node cm-worker.js -t [secret]

node cm-worker.js -fcc [fccProfileURL]

node cm-worker.js firebaseUrl=http://singpath-play.firebase.com token=myToken numTasks=1 maxIdle=5


