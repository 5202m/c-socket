'use static';
const config = require("../config/config");
const socketIo = require('socket.io');
const socketRedis = require('socket.io-redis');
class SocketServer{
    constructor(server){}
    start(server){
        this.io =  socketIo(server);
        this.io.adapter(socketRedis(
            //使用redis解决多进程间socket通讯
            {host: config.redis.host, port: config.redis.port }
        ));
        //初始化 handler
        this.handler =  require("./handler/Handler");
        this.handler.init(this.io);
        //命名空间  //TODO 后续应改成动态获取 可动态设置
        for(let i in config.namespace){
            this.namespaceCall(i);
        }
        //初始化服务层消息监听
        require("./handler/ServerHandler").init(this.io);
    }
    /****
     * 初始化命名空间 设置监听
     * @param namespace
     * @param handler
     */
    namespaceCall(namespace){
        let namespaceIo = this.io.of(namespace);
        let _this = this;
        namespaceIo.on("connection",(socket)=>{
            //socket 初始化
            _this.initSocket(socket);
            socket.set("namespace",namespace);
            _this.handler.connection(socket);
            //断开连接
            socket.on("disconnect",()=>{
                _this.handler.disconnect(socket);
            });
        });
    }

    /****
     * 对socket添加常用方法 可加入在原型之上。
     * @param socket
     */
    initSocket(socket){
        if(socket.set && socket.get){
            return;
        }
        socket._myData_ = {};
        socket.set = function(key,value,fn){
            if(value){
                socket._myData_[key] = value;
            }else{
                delete  socket._myData_[key];
            }
            fn && fn();
        };
        socket.get = function(key,fn){
            var value =  socket._myData_[key];
            if(value){
                fn && fn(value);
                return value;
            }else{
                return ;
            }
        };
        socket.getAll = function(){
            return socket._myData_;
        }
    }
    close(){
        this.io.close();
    }
}

module.exports = new SocketServer();
