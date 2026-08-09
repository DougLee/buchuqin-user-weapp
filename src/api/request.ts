import type { ApiResult } from '../types'
const BASE_URL='http://localhost:3000/api/v1'
type RequestOptions=Omit<UniApp.RequestOptions,'url'>
export async function request<T>(path:string,options:RequestOptions={}):Promise<T>{const token=uni.getStorageSync('token') as string;return new Promise((resolve,reject)=>{uni.request({...options,url:`${BASE_URL}${path}`,header:{'content-type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(options.header||{})},success(res){const body=res.data as ApiResult<T>;if(res.statusCode>=200&&res.statusCode<300&&body.code===0)resolve(body.data);else{uni.showToast({title:body.message||'请求失败',icon:'none'});reject(new Error(body.message))}},fail(error){uni.showToast({title:'服务暂时不可用',icon:'none'});reject(error)}})})}
