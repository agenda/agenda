export const hasMongoProtocol = function(url) {
  return url.match(/mongodb(?:\+srv)?:\/\/.*/) !== null;
};

