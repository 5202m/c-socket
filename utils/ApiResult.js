'use strict';
class ApiResult{
    constructor(){}
    result(error,data,dataType){
        let resultObj={result:0,msg:'OK'};
        if(error){
            if(typeof error === "object" && error.errcode){
                resultObj.result=error.errcode;
                resultObj.msg=error.errmsg;
            }else{
                resultObj.result=1;
                resultObj.msg=error;
            }
        }else{
            resultObj.data=data;
        }
        return resultObj;
    }
}
//导出类
module.exports = new ApiResult();
