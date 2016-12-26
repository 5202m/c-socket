var helper = {};
exports.helper = helper;

var log4js = require('log4js');
var fs = require("fs");
var path = require("path");

// 加载配置文件
var objConfig = JSON.parse(fs.readFileSync("../log4j/log4j.json", "utf8"));


// 目录创建完毕，才加载配置，不然会出异常
log4js.configure(objConfig);

var logDebug = log4js.getLogger('logDebug');
var logInfo = log4js.getLogger('logInfo');
var logWarn = log4js.getLogger('logWarn');
var logErr = log4js.getLogger('logErr');

helper.debug = function(msg){
    if(msg == null)
        msg = "";
    logDebug.debug(msg);
};

helper.info = function(msg){
    if(msg == null)
        msg = "";
    logInfo.info(msg);
};

helper.warn = function(msg){
    if(msg == null)
        msg = "";
    logWarn.warn(msg);
};

helper.error = function(msg, exp){
    if(msg == null)
        msg = "";
    if(exp != null)
        msg += "\r\n" + exp;
    logErr.error(msg);
};

helper.getLogger = function(loggerName){
    var logger=log4js.getLogger(loggerName);
    logger.setLevel(log4js.levels.INFO);
    return logger;
};

// 配合express用的方法
exports.use = function(app) {
    //页面请求日志, level用auto时,默认级别是WARN
    app.use(log4js.connectLogger(logInfo, {level:'debug', format:':method :url'}));
}

// 判断日志目录是否存在，不存在时创建日志目录
function checkAndCreateDir(dir){
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
}

// 指定的字符串是否绝对路径
function isAbsoluteDir(path){
    if(path == null)
        return false;
    var len = path.length;

    var isWindows = process.platform === 'win32';
    if(isWindows){
        if(len <= 1)
            return false;
        return path[1] == ":";
    }else{
        if(len <= 0)
            return false;
        return path[0] == "/";
    }
}