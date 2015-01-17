var fs = require('fs');
var tinder = require('tinderjs');

var secrets = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));

// Get recommendations.
var client = new tinder.TinderClient();
client.authorize(
  secrets.token,
  secrets.facebook_id,
  function() {
    console.log('Authorized');
    client.getRecommendations(10, function(error, data) {
      if (error) throw error;
      console.log('Recommendations received.');

      // Display recommendations.
      var resultsStr = JSON.stringify(data.results, null, 2);

      var pre = document.createElement('pre');
      var content = document.createTextNode(resultsStr);
      pre.appendChild(content);
      document.body.appendChild(pre);
    });
  }
);

// Make the client available for me to mess with.
window.client = client;
