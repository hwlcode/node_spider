"use strict";

var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var LinkSchema = new Schema({
        link: {type: String}
    }, {
        timestamps: true
    }
);

mongoose.model('Link', LinkSchema);