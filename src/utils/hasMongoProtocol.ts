export const hasMongoProtocol = (url: string): boolean => /mongodb(?:\+srv)?:\/\/.*/.test(url);
