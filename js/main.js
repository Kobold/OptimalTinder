// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

var fs = require('fs');

var React = require('react');
var tinder = require('tinderjs');
var _ = require('lodash');


/*
 * React components.
 */
var Match = React.createClass({
  propTypes: {
    match: React.PropTypes.object.isRequired
  },

  render: function() {
    var person = this.props.match.person;

    return (
      <div>
        <p>{person.name}</p>
        {person.photos.map(function(photo) {
          return <img src={photo.processedFiles[3].url} key={photo.id} />
        })}
      </div>
    );
  }
});

var MatchList = React.createClass({
  propTypes: {
    matches: React.PropTypes.array.isRequired
  },

  render: function() {
    var matchNodes = this.props.matches
      .filter(function(match) {
        return match.person !== undefined;
      })
      .map(function(match) {
        return <Match match={match} key={match._id} />
      });
    return <div>{matchNodes}</div>;
  }
});


var makeOnload = function(data) {
  return function() {
    var displayMatches = _.take(data.matches, 20);
    React.render(
      <MatchList matches={displayMatches} />,
      document.getElementById('application')
    );
  };
};



// Get recommendations.
var secrets = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));

// If there's cached data for development, use that.
if (_.has(secrets, 'localHistory')) {
  console.log('Local data');
  var data = JSON.parse(fs.readFileSync(secrets.localHistory, 'utf8'));
  window.onload = makeOnload(data);
} else {
  console.log('Live data');
  var client = new tinder.TinderClient();
  client.authorize(
    secrets.token,
    secrets.facebook_id,
    function() {
      console.log('Authorized');
      client.getHistory(function(error, data) {
        if (error) throw error;
        console.log('History received.');

        window.onload = makeOnload(data);
      });
    }
  );
}


