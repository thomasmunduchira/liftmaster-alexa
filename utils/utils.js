const utils = {
  log(title, message) {
    // title: string, message: object
    console.log(`**** ${title}:`, JSON.stringify(message));
  },
};

module.exports = utils;
