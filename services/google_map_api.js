const key = 'AIzaSyCiR_X0YtIQkd-nVsIHOHEGe8yqhiKrVaE';
const googleMapsClient = require('@google/maps').createClient({
  key,
  Promise
});

export default googleMapsClient;
