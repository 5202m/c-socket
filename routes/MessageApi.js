'use strict';
const router =  require('express').Router();
const serverHandler = require("../socket/handler/ServerHandler");
const storageService = require("../service/StorageService");
const apiResult = require("../utils/ApiResult");
const errorMessage = require("../utils/ErrorMessage");
router.post('/msg', function(req, res) {
    //校验？namespace token? 合法性？
    try{
        let data = JSON.parse(req.body.data);
        if(!data || !data.namespace){
            res.json(apiResult.result(errorMessage.code_1000));
            return;
        }
        if(data.msg && data.msg.eventType){
            let newMsg = {
                eventType:data.msg.eventType,
                ext:data.msg.ext
            };
            serverHandler.onMessage(data.namespace,newMsg);
            res.json(apiResult.result());
            return;
        }
        res.json(apiResult.result(errorMessage.code_1000));
    }catch (e){
        console.log(e);
        res.json(apiResult.result(errorMessage.code_1001));
    }
});

router.get("/onlineCount",function(req, res){
    try{
        let data = JSON.parse(req.query.data);
        if(!data || !data.namespace || !data.room){
            res.json(apiResult.result(errorMessage.code_1000));
            return;
        }
        storageService.getRoomUserCount(data.namespace,data.room)
        .then((result)=>{
            res.json(apiResult.result(null,{count:result}));
        },(error)=>{
            res.json(apiResult.result(errorMessage.code_1001));
        });
    }catch (e){
        res.json(apiResult.result(errorMessage.code_1001));
    }
});

router.get("/isOnline",function(req, res){
    try{
        let data = JSON.parse(req.query.data);
        if(!data || !data.namespace || !data.uuid || !data.room){
            res.json(apiResult.result(errorMessage.code_1000));
            return;
        }
        storageService.roomExistsUser(data.namespace,data.room,data.uuid)
        .then((result)=>{
            res.json(apiResult.result(null,{online:result}));
        },(error)=>{
            res.json(apiResult.result(errorMessage.code_1001));
        });
    }catch (e){
        res.json(apiResult.result(errorMessage.code_1001));
    }
});


module.exports = router;