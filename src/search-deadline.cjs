async function withDeadline(work,milliseconds=30000){
  const controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{const error=new Error('검색 시간이 초과됐습니다. 잠시 후 다시 조회하세요.');controller.abort(error);reject(error);},milliseconds);
  });
  try{return await Promise.race([Promise.resolve().then(()=>work(controller.signal)),timeout]);}
  finally{clearTimeout(timer);}
}
module.exports={withDeadline};
