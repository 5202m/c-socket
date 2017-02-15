'use strict';
const events = require("events");
module.exports = {
    namespace: {
        "/studio": {
            
        },
        "/fxstudio": {
            
        },
        "/hxstudio": {
            
        },
        "/cfstudio": {
            
        },
        "/fxFinance": {  //fx财经日历
            
        }
    },
    redis: {
        host: '192.168.35.81',
        port: 6379
    },
    eventType: {
        join: "join",
        leave: "leave",
        setUUID: "setUUID",
        sendMsg: "sendMsg",
        onlineList:"onlineList",
        init:"init"
    }
};