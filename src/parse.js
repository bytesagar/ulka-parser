const vm = require('vm');
const path = require('path');
const fs = require('fs');
const { replaceString, hasEqualSign, replaceAsync } = require('./utils');

const defaultOptions = {
  base: process.cwd(),
  logError: true,
};

async function parser(ulkaTemplate, values = {}, options = defaultOptions) {
  try {
    return await replaceAsync(
      ulkaTemplate,
      /\\?{%(.*?)%}/gs,
      replaceCallback(ulkaTemplate, values, options),
    );
  } catch (e) {
    options.logError && console.log('>> ', e.message);
    throw e;
  }
}

const replaceCallback = (ulkaTemplate, values, options) => async (...args) => {
  let jsCode = args[1];

  values = {
    require: reqPath => {
      options.base = path.isAbsolute(reqPath) ? process.cwd() : options.base;
      const rPath = path.join(options.base, reqPath);
      if (fs.existsSync(rPath)) return require(rPath);
      return require(reqPath);
    },
    ...values,
    console,
  };

  // If first index is equal sign then remove  equal or minus sign
  const containsEqualsInFirstIndex = jsCode[0] === '=';
  const containsMinusInFirstIndex = jsCode[0] === '-';

  if (containsEqualsInFirstIndex || containsMinusInFirstIndex)
    jsCode = jsCode.substr(1);

  /*
  - {% sth = "roshan" %}
  - \{% sth %} => {% sth %}
  - \\{% sth %} => \{% "roshan" %}
 */
  if (args[0][0] === '\\' && ulkaTemplate[args[2] - 1] !== '\\')
    return args[0].slice(1);

  jsCode = jsCode.replace(/(var |let |const )/gs, '');

  const result = vm.runInNewContext(jsCode, values);

  const codeWithoutString = replaceString(jsCode, '');
  const containsEqual = hasEqualSign(codeWithoutString);
  const shouldPrintResult =
    (!containsEqual || containsEqualsInFirstIndex) &&
    !containsMinusInFirstIndex;

  let dataToReturn = await result;

  if (Array.isArray(dataToReturn)) dataToReturn = dataToReturn.join('');

  return !shouldPrintResult ? '' : dataToReturn || '';
};

module.exports = parser;
