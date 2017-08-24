"use strict";

var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var FruitSchema = new Schema({
        proId: {type: String},
        proImg: {type: String},
        proTitle: {type: String},
        beginNum: {type: Number, default: 0},
        proPrice: {type: Number, default: 0},
        promotionPrice: {type: Number, default: 0},
        name: {type: String},
        address: {type: String},
        link: {type: String}
    }, {
        timestamps: true
    }
);

mongoose.model('Fruit', FruitSchema);