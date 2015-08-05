'use strict';
const React = require('react');


const MatchImage = React.createClass({
  propTypes: {
    photo: React.PropTypes.object.isRequired,
  },

  render() {
    const [,, smallPhoto, xsPhoto] = this.props.photo.processedFiles;

    return (
      <img className='match-image'
           src={xsPhoto.url}
           srcSet={`${xsPhoto.url} 1x, ${smallPhoto.url} 2x`} />
    );
  }
});

export default MatchImage;
