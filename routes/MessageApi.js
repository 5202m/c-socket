'use strict';
let router =  require('express').Router();
let serverHandler = require("../socket/handler/ServerHandler");
const storageService = require("../service/StorageService");
router.post('/msg', function(req, res) {
    //校验？namespace token? 合法性？
    try{
        let data = JSON.parse(req.body.data);
        if(!data || !data.namespace){
            res.json({code:401,msg:"参数有误!"});
            return;
        }
        if(data.msg && data.msg.msgType){
            let newMsg = {
                //用于过滤掉不需要的数据传输
                msgType:data.msg.msgType
            };
            if(data.msg.msgData){
                newMsg.msgData = data.msg.msgData;
            }
            if(data.msg.sendMsgType){
                newMsg.sendMsgType = data.msg.sendMsgType;
            }
            if(data.msg.ext){
                newMsg.ext = data.msg.ext;
            }
            serverHandler.onMessage(data.namespace,newMsg);
            res.json({code:200});
            return;
        }
        res.json({code:401,msg:"参数有误!"});
    }catch (e){
        res.json({code:500});
    }
});

router.get("/onlineCount",function(req, res){
    try{
        let data = JSON.parse(req.query.data);
        if(!data || !data.namespace || !data.room){
            res.json({code:401,msg:"参数有误!"});
            return;
        }
        storageService.getRoomUserCount(data.namespace,data.room)
        .then((result)=>{
            res.json({code:200,data:{count:result}});
        },(error)=>{
            res.json({code:500,msg:"获取失败!"});
        });
    }catch (e){
        res.json({code:500});
    }
});

router.get("/isOnline",function(req, res){
    try{
        let data = JSON.parse(req.query.data);
        if(!data || !data.namespace || !data.uuid || !data.room){
            res.json({code:401,msg:"参数有误!"});
            return;
        }
        storageService.roomExistsUser(data.namespace,data.room,data.uuid)
        .then((result)=>{
            res.json({code:200,data:{online:result}});
        },(error)=>{
            res.json({code:500,msg:"获取失败!"});
        });
    }catch (e){
        res.json({code:500});
    }
});


module.exports = router;