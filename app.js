'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const logHelper = require("./log4j/logHelper");
const app = express();
app.use(bodyParser.json({limit: '50mb'}));//最大传输量
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(cookieParser());
logHelper.use(app);

app.use("/api/chat/",require("./routes/MessageApi"));

app.use(function(req, res, next) {
    res.json({code:404,msg:"Not Found"});
});

app.use(function(err, req, res, next) {
    res.json({code:500,msg:err.message});
});

module.exports = app;
