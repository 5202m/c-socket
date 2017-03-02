'use strict';
const config=require('../../config/config');
const request = require('request');
/*****
 * 用于处理客户端的消息，并对消息处理（转发到对于服务层，或自行处理）
 */
class ClientHandler{
    constructor(){}
    message(msgType,socket,...msgData){
        let url = `${config.apiURL}/message`;

        if(!url){
            return;
        }
        if(msgType != 'disconnect'){ //目前只处理断开消息
            return;
        }
        console.log(`Posting disconnect information to ${url}...`);
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
                    console.log("已通知服务层断开连接。。。。", JSON.stringify(response.body));
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
