'use strict';
// A fix for client-side components to work via require.
global.document = window.document;
global.navigator = window.navigator;

import fs from 'fs';
import gui from 'nw.gui';

const React = require('react');
import _ from 'lodash';
import classNames from 'classnames';
import Reflux from 'reflux';
import request from 'superagent';
import tinder from 'tinderjs';

const LOCAL = true;
const LOGIN_URL = 'https://m.facebook.com/dialog/oauth?client_id=464891386855067&' +
    'redirect_uri=https://www.facebook.com/connect/login_success.html&' +
    'scope=user_birthday,user_relationship_details,user_likes,user_activities,' +
    'user_education_history,user_photos,user_friends,user_about_me,email,' +
    'public_profile&response_type=token';


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
});


const LiveMatchStore = Reflux.createStore({
  init() {
    this.client = null;
    this.loading = false;
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


const LocalMatchStore = Reflux.createStore({
  init() {
    this.loading = false;
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


const MatchStore = LOCAL ? LocalMatchStore : LiveMatchStore;
MatchStore.listenToMany(TinderActions);


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
      <div className='match'>
        <div className='match-heading'>
          <strong>{person.name}</strong>
          {' '}
          <span className='match-seen'>seen {person.ping_time}</span>
        </div>
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


// Start the app.
React.render(<Application />, document.getElementById('application'));
TinderActions.loadClient();

