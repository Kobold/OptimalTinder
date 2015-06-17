'use strict';
// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

import fs from 'fs';
import gui from 'nw.gui';

const React = require('react');
import _ from 'lodash';
import Reflux from 'reflux';
import tinder from 'tinderjs';

const CLIENT = new tinder.TinderClient();
const LOCAL = true;
const SECRETS = JSON.parse(fs.readFileSync('./secrets.json', 'utf8'));


/*
 * Flux components.
 */
const TinderActions = Reflux.createActions([
  'loadHistory',
  'loadHistorySuccess',
]);


const MatchStore = Reflux.createStore({
  listenables: TinderActions,
  init() {
    this.loading = false;
    this.matches = [];
  },

  onLoadHistory(){
    this.loading = true;
    this.trigger(this.getState());

    if (LOCAL) {
      const history = JSON.parse(fs.readFileSync('./history.json', 'utf8'));
      TinderActions.loadHistorySuccess(history);
    } else {
      CLIENT.getHistory((error, history) => {
        if (error) throw error;
        console.log('History received.');
        TinderActions.loadHistorySuccess(history);
      });
    }
  },

  onLoadHistorySuccess(history) {
    this.loading = false;
    this.matches = history.matches;
    this.trigger(this.getState());
  },

  getState() {
    return {
      loading: this.loading,
      matches: this.matches,
    };
  },

  getInitialState() {
    return this.getState();
  },
});


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

const Application = React.createClass({
  mixins: [Reflux.connect(MatchStore)],

  handleLoadHistory(e) {
    e.preventDefault();
    TinderActions.loadHistory();
  },

  render() {
    const displayMatches = _(this.state.matches)
      .filter(match => _.has(match, 'person'))
      .sortBy(match => match.person.ping_time)
      .reverse()
      .take(60)
      .value();

    return (
      <div>
        <a className='btn btn-primary' onClick={this.handleLoadHistory}>Load Matches</a>
        <MatchList matches={displayMatches} />
      </div>
    );
  },
});


// Add a nice menu bar with copy and paste.
const nativeMenuBar = new gui.Menu({type: 'menubar'});
nativeMenuBar.createMacBuiltin('OptimalTinder');
const win = gui.Window.get();
win.menu = nativeMenuBar;


// Authorize the client and start the app.
onload = function() {
  if (LOCAL) {
    React.render(<Application />, document.getElementById('application'));
  } else {
    CLIENT.authorize(SECRETS.token, SECRETS.facebook_id, () => {
      console.log('Authorized');
      React.render(<Application />, document.getElementById('application'));
    });
  }
};

