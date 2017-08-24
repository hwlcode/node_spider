"use strict";

var mongoose = require('mongoose');
var db;

db = 'mongodb://localhost:27017/fruits';

mongoose.connect(db, function(err){
    if (err) {
        console.error('connect to %s error: ', db, err.message);
        process.exit(1);
    }
});

require('./schema/fruit');
require('./schema/link');

module.exports = {
    FruitModel: mongoose.model('Fruit'),
    LinkModel: mongoose.model('Link')
}