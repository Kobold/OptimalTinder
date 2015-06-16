'use strict';
// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var Fluxxor = require('fluxxor');
var React = require('react');
var tinder = require('tinderjs');

var FluxMixin = Fluxxor.FluxMixin(React);
var StoreWatchMixin = Fluxxor.StoreWatchMixin;

var client = new tinder.TinderClient();
var secrets = require('./secrets.json');

// var gui = require('nw.gui');
// var win = gui.Window.get();
// var nativeMenuBar = new gui.Menu({ type: "menubar" });
// nativeMenuBar.createMacBuiltin("OptimalTinder");
// win.menu = nativeMenuBar;

/*
 * Flux components.
 */
var constants = {
  LOAD_HISTORY: 'LOAD_HISTORY',
  LOAD_HISTORY_SUCCESS: 'LOAD_HISTORY_SUCCESS'
}

var MatchStore = Fluxxor.createStore({
  initialize: function() {
    this.loading = false;
    this.matches = [];

    this.bindActions(
      constants.LOAD_HISTORY, this.onLoadHistory,
      constants.LOAD_HISTORY_SUCCESS, this.onLoadHistorySuccess
    );
  },

  onLoadHistory: function() {
    this.loading = true;
    this.emit('change');
  },

  onLoadHistorySuccess: function(payload) {
    this.loading = false;
    this.matches = payload.history.matches;
    this.emit('change');
  },

  getState: function() {
    return {
      loading: this.loading,
      matches: this.matches
    };
  }
});

var actions = {
  loadHistory: function(history) {
    this.dispatch(constants.LOAD_HISTORY);

    client.getHistory(function(error, data) {
      if (error) throw error;
      console.log('History received.');
      this.dispatch(constants.LOAD_HISTORY_SUCCESS, {history: data});
    }.bind(this));
  }
};

var stores = {
  MatchStore: new MatchStore()
};

var flux = new Fluxxor.Flux(stores, actions);


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
        <p><strong>{person.name}</strong> - {person.ping_time}</p>
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

var Application = React.createClass({
  mixins: [FluxMixin, StoreWatchMixin('MatchStore')],

  getStateFromFlux: function() {
    return this.getFlux().store('MatchStore').getState();
  },

  render: function() {
    var displayMatches = _(this.state.matches)
      .filter(function(match) { return _.has(match, 'person'); })
      .sortBy(function(match) { return match.person.ping_time; })
      .reverse()
      .take(60)
      .value();
    return (
      <div>
        <a className="btn btn-primary" onClick={this.handleLoadHistory}>Load Matches</a>
        <MatchList matches={displayMatches} />
      </div>
    );
  },

  handleLoadHistory: function(e) {
    e.preventDefault();
    this.getFlux().actions.loadHistory();
  }
});

// Authorize the client and start the app.
onload = function() {
  client.authorize(
    secrets.token,
    secrets.facebook_id,
    function() {
      console.log('Authorized');
      React.render(
        <Application flux={flux} />,
        document.getElementById('application')
      );
    }
  );
};
