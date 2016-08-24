var xray=require('x-ray');
var Xray=new xray();
var urltoParse= process.argv[2];

var allAchievements = {}
var callback = function(theJson){	
	
	for(var i=0; i<theJson.allAchievements.length; i++){
		//console.log(theJson.allAchievements[i]);
		if('key' in theJson.allAchievements[i]){
		  console.log(theJson.allAchievements[i].key);
		  allAchievements[theJson.allAchievements[i].key] = theJson.allAchievements[i]
		}
	}	
	console.log(allAchievements);
	console.log(theJson.allAchievements.length,"achievements fetched from FreeCodeCamp");
}

var fccParser = function(profileUrl,callback){
	Xray(profileUrl,{   
	title: 'title',
	allAchievements: Xray('.challenge-title',[
		{'key':'a@name',
		  'title':'span',
		  'url':'a@href'
	      }
		])})(function(err, obj){
			if ( err ) { console.log('xray error:  ' + err); return; }
			else { callback(obj);}
	});
}

fccParser(urltoParse,callback);