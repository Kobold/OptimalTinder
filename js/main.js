'use strict';
// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

import fs from 'fs';
import gui from 'nw.gui';

const React = require('react');
import _ from 'lodash';
import classNames from 'classnames';
import moment from 'moment';
import Reflux from 'reflux';
import request from 'superagent';
import tinder from 'tinderjs';

const LOCAL = false;
const LOGIN_URL = 'https://m.facebook.com/dialog/oauth?client_id=464891386855067&' +
    'redirect_uri=https://www.facebook.com/connect/login_success.html&' +
    'scope=user_birthday,user_relationship_details,user_likes,user_activities,' +
    'user_education_history,user_photos,user_friends,user_about_me,email,' +
    'public_profile&response_type=token';


function formatTimestamp(string) {
  return moment(string).format('MMMM Do YYYY, h:mm a');
}


class ClientFetcher {
  constructor() {
    this.client = new tinder.TinderClient();
  }

  authorize(paramString, resolve, reject) {
    const fbAuthData = _.zipObject(paramString.split('&')
                                              .map(p => p.split('=')));
    const fbUserId = this._getFBUserId(fbAuthData['access_token'], reject);

    this.client.authorize(fbAuthData['access_token'], resolve, () => {
      console.log('Authorized');
      resolve(this.client);
    });
  }

  _getFBUserId(token, reject) {
    const graphUrl = 'https://graph.facebook.com/me?access_token=' + token;
    request.get(graphUrl).end((err, res) => {
      console.log('_getFBUserId');
      if (res.ok) {
        console.log('ok', res.body);
        return res.body.id;
      } else {
        console.log('FUCK: _getFBUserId');
        reject('Error: Could not get FB User ID: ' + res.text);
      }
    });
  }

  static fetch(resolve, reject) {
    let loginPopup = gui.Window.open(LOGIN_URL, {
      title: 'Login to Facebook',
      position: 'center',
      width: 400,
      height: 480,
      focus: true
    });

    const clientFetcher = new ClientFetcher();
    const checkTokenInterval = setInterval(() => {
      if (loginPopup) {
        const loginPopupWindow = loginPopup.window;
        if (loginPopupWindow.closed) {
          clearInterval(checkTokenInterval);
        } else {
          const paramString = loginPopupWindow.document.URL.split('#')[1];
          if (!!paramString) {
            loginPopupWindow.close();
            clearInterval(checkTokenInterval);

            clientFetcher.authorize(paramString, resolve, reject);
          }
        }
      }
    }, 500);

    loginPopup.on('closed', () => {
      clearInterval(checkTokenInterval);
      loginPopup = null;
    });
  }
}


/*
 * Flux components.
 */
const TinderActions = Reflux.createActions({
  'loadClient': {children: ['completed', 'failed']},
  'loadHistory': {children: ['completed', 'failed']},
  'loadDistance': {},
});


function loadMatchDistancesAsync([match, ...rest]) {
  window.setTimeout(() => {
    console.log(`loading ${match.person._id}`);
    TinderActions.loadDistance(match.person._id);
    if (!_.isEmpty(rest)) {
      loadMatchDistancesAsync(rest);
    }
  }, 500);
}


const LiveMatchStore = Reflux.createStore({
  init() {
    this.client = null;
    this.loading = false;
    this.matchDistances = {};
    this.matches = [];
  },

  onLoadClient() {
    ClientFetcher.fetch(TinderActions.loadClient.completed,
                        TinderActions.loadClient.failed);
  },

  onLoadClientCompleted(client) {
    this.client = client;
    window.setTimeout(TinderActions.loadHistory, 2500);
  },

  onLoadHistory() {
    this.loading = true;
    this.trigger(this.getState());

    this.client.getHistory((error, history) => {
      if (error) throw error;
      console.log('History received.');
      TinderActions.loadHistory.completed(history);
    });
  },

  onLoadHistoryCompleted(history) {
    this.loading = false;
    this.matches = history.matches;
    this.trigger(this.getState());

    const displayMatches = _(this.matches)
      .filter(match => _.has(match, 'person'))
      .sortBy(match => match.person.ping_time)
      .reverse()
      .take(60)
      .value();
    loadMatchDistancesAsync(displayMatches);
  },

  onLoadDistance(personId) {
    this.client.getUser(personId, (error, data) => {
      if (error) throw error;
      this.matchDistances[personId] = data.results.distance_mi;
      this.trigger(this.getState());
    });
  },

  getState() {
    return {
      loading: this.loading,
      matchDistances: this.matchDistances,
      matches: this.matches,
    };
  },

  getInitialState() {
    return this.getState();
  },
});


const LocalMatchStore = Reflux.createStore({
  init() {
    this.loading = false;
    this.matchDistances = {};
    this.matches = [];
  },

  onLoadClient() {
    window.setTimeout(TinderActions.loadHistory, 10);
  },

  onLoadHistory() {
    this.loading = true;
    this.trigger(this.getState());

    const history = JSON.parse(fs.readFileSync('./history.json', 'utf8'));
    window.setTimeout(() => {
      TinderActions.loadHistory.completed(history);
    }, 10);
  },

  onLoadHistoryCompleted(history) {
    this.loading = false;
    this.matches = history.matches;
    this.trigger(this.getState());

    const displayMatches = _(this.matches)
      .filter(match => _.has(match, 'person'))
      .sortBy(match => match.person.ping_time)
      .reverse()
      .take(60)
      .value();
    loadMatchDistancesAsync(displayMatches);
  },

  onLoadDistance(personId) {
    const min = 1, max = 200;
    this.matchDistances[personId] = Math.floor(Math.random() * (max - min)) + min;
    this.trigger(this.getState());
  },

  getState() {
    return {
      loading: this.loading,
      matchDistances: this.matchDistances,
      matches: this.matches,
    };
  },

  getInitialState() {
    return this.getState();
  },
});


const MatchStore = LOCAL ? LocalMatchStore : LiveMatchStore;
MatchStore.listenToMany(TinderActions);


/*
 * React components.
 */
const Distance = React.createClass({
  propTypes: {
    distance: React.PropTypes.number,
  },

  render: function() {
    if (_.isNull(this.props.distance)) {
      return (
        <span className='distance-unknown'>
          - Miles Away
        </span>
      );
    } else {
      return (
        <span className='distance'>
          {this.props.distance.toLocaleString()} Miles Away
        </span>
      );
    }
  }
});


var Match = React.createClass({
  propTypes: {
    distance: React.PropTypes.number,
    match: React.PropTypes.object.isRequired,
  },

  render: function() {
    const messages = this.props.match.messages;
    const person = this.props.match.person;

    const style = {};
    if (!_.isNull(this.props.distance) && this.props.distance < 50) {
      style.backgroundColor = '#bdecb6';
    }

    return (
      <div className='match' style={style}>
        <div className='match-heading'>
          <h4>{person.name}</h4>
          {' '}
          <span className='match-seen'>seen {formatTimestamp(person.ping_time)}</span>
          <Distance distance={this.props.distance} />
        </div>
        {person.photos.map((photo) =>
          <img key={photo.id}
               className='match-image'
               src={photo.processedFiles[3].url}
               srcSet={`${photo.processedFiles[3].url} 1x, ${photo.processedFiles[2].url} 2x`} />
        )}
        {messages.map((message) =>
          <p key={message._id}>
            <em>{formatTimestamp(message.sent_date)}</em> {message.message}
          </p>
        )}
      </div>
    );
  }
});

var MatchList = React.createClass({
  propTypes: {
    matchDistances: React.PropTypes.object.isRequired,
    matches: React.PropTypes.array.isRequired,
  },

  render: function() {
    return (
      <div>
        {this.props.matches.map((match) => {
          const distance = _.get(this.props.matchDistances, match.person._id, null);
          return <Match key={match._id} match={match} distance={distance} />;
        })}
      </div>
    );
  }
});

const Application = React.createClass({
  mixins: [Reflux.connect(MatchStore)],

  handleLoadHistory(e) {
    e.preventDefault();
    if (!this.state.loading) {
      TinderActions.loadHistory();
    }
  },

  render() {
    const buttonClasses = ['btn', 'btn-primary', 'btn-sm', {'disabled': this.state.loading}];
    const displayMatches = _(this.state.matches)
      .filter(match => _.has(match, 'person'))
      .sortBy(match => match.person.ping_time)
      .reverse()
      .take(60)
      .value();

    return (
      <div>
        <div className='menubar'>
          <a className={classNames(buttonClasses)} onClick={this.handleLoadHistory}>
            Load Matches
            {' '}
            {this.state.loading ? <i className='fa fa-spinner fa-spin' /> : null}
          </a>
        </div>
        <MatchList matches={displayMatches} matchDistances={this.state.matchDistances} />
      </div>
    );
  },
});


// Add a nice menu bar with copy and paste.
const nativeMenuBar = new gui.Menu({type: 'menubar'});
nativeMenuBar.createMacBuiltin('OptimalTinder');
const win = gui.Window.get();
win.menu = nativeMenuBar;


// Start the app.
React.render(<Application />, document.getElementById('application'));
TinderActions.loadClient();

