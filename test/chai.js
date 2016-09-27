'use strict';

const chai = require('chai');
const sinonChai = require('sinon-chai');
const dirtyChai = require('dirty-chai');


// Register dirtyChai
//
// See https://github.com/prodatakey/dirty-chai
chai.use(dirtyChai);

// Register sinonChai plugin
//
// See https://github.com/domenic/sinon-chai
chai.use(sinonChai);


exports.expect = chai.expect;
exports.sinon = require('sinon');
