// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var Datastore = require('nedb')
var React = require('react');
var tinder = require('tinderjs');


var db = new Datastore({
  filename: path.join(require('nw.gui').App.dataPath, 'something.db'),
  autoload: true
});
var secrets = require('./secrets.json');


/*
 * React components.
 */
var Match = React.createClass({
  propTypes: {
    match: React.PropTypes.object.isRequired
  },

  render: function() {
    var messages = this.props.match.messages;
    var person = this.props.match.person;

    return (
      <div>
        <p>{person.name} - {person.ping_time}</p>
        {person.photos.map(function(photo) {
          return <img src={photo.processedFiles[3].url} key={photo.id} />;
        })}
        {messages.map(function(message) {
          return <p key={message._id}>{message.sent_date} {message.message}</p>;
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
      .map(function(match) {
        return <Match match={match} key={match._id} />
      });
    return <div>{matchNodes}</div>;
  }
});


var makeOnload = function(data) {
  return function() {
    var displayMatches = _(data.matches)
      .filter(function(match) { return _.has(match, 'person'); })
      .sortBy(function(match) { return match.person.ping_time; })
      .reverse()
      .take(40)
      .value();
    React.render(
      <MatchList matches={displayMatches} />,
      document.getElementById('application')
    );
  };
};



// Get recommendations.
var client = new tinder.TinderClient();
client.authorize(
  secrets.token,
  secrets.facebook_id,
  function() {
    console.log('Authorized');
    client.getHistory(function(error, data) {
      if (error) throw error;
      console.log('History received.');
      console.log(data);

      makeOnload(data)();
    });
  }
);


