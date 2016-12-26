/**
 * Created by kirk on 2016/12/7.
 */
'use strict';
const config=require('../../config/config');
const request = require('request');
/*****
 * 用于处理客户端的消息，并对消息处理（转发到对于服务层，或自行处理）
 */
class ClientHandler{
    constructor(){}
    message(msgType,socket,...msgData){
        let namespace = this._getNamespaceBySocket(socket);
        let namespaceName = namespace.name;
        let namespaceConfig = config.namespace[namespaceName];
        if(!namespaceConfig) {
            return;
        }
        let url = namespaceConfig.serverUrl;

        if(!url){
            return;
        }
        if(msgType != 'disconnect'){ //目前只处理断开消息
            return;
        }
        request.post({
                url: url,
                form: {
                     data:{
                         msgType: msgType,
                         msgData: msgData
                     }
            }},function(error, response){
                if(error){
                    console.error("消息通知服务层失败", error);
                }else{
                    console.log("已通知服务层。。。。");
                }
            }
        );
    }
    _getNamespaceBySocket(socket){
        return {
            name:socket.nsp.name,
            io:socket.nsp
        }
    }
}

module.exports = new ClientHandler();
